/**
 * Backfill: regenerate every recording's thumbnail from the FIRST frame of its
 * video. Run once after switching record-time capture to the first frame.
 *
 *   bun --env-file=.env.local scripts/backfill-first-frame-thumbnails.ts
 *
 * Add --dry to list what would change without writing.
 * Needs ffmpeg on PATH plus the R2 + Supabase service-role env vars.
 */
import { spawn } from "node:child_process";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry");

const accountId = process.env.R2_ACCOUNT_ID!;
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const VIDEOS_BUCKET = process.env.R2_VIDEOS_BUCKET!;
const THUMBNAILS_BUCKET = process.env.R2_THUMBNAILS_BUCKET!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function thumbnailKeyFor(userId: string, id: string) {
  return `${userId}/${id}.jpg`;
}

// Pull the first decodable frame straight from a presigned URL. -update 1 makes
// ffmpeg keep the first frame even though we ask for a single image on stdout;
// webm from MediaRecorder reports duration=Infinity, so seeking is unreliable —
// reading from the start and taking one frame is the robust path.
function extractFirstFrame(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-loglevel",
      "error",
      "-i",
      url,
      "-frames:v",
      "1",
      "-f",
      "image2",
      "-c:v",
      "mjpeg",
      "-q:v",
      "3",
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", (d) => errChunks.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else
        reject(
          new Error(
            `ffmpeg exited ${code}: ${Buffer.concat(errChunks).toString().trim()}`,
          ),
        );
    });
  });
}

async function main() {
  const { data: recordings, error } = await supabase
    .from("recordings")
    .select("id, user_id, storage_path, thumbnail_path, title")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  if (!recordings?.length) {
    console.log("No recordings found.");
    return;
  }

  console.log(
    `${recordings.length} recording(s)${dryRun ? " (dry run)" : ""}\n`,
  );

  let done = 0;
  let failed = 0;
  for (const rec of recordings) {
    const label = `${rec.title ?? "untitled"} (${rec.id})`;
    if (!rec.storage_path) {
      console.log(`-  skip, no video: ${label}`);
      continue;
    }
    try {
      const videoUrl = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: VIDEOS_BUCKET,
          Key: rec.storage_path,
        }),
        { expiresIn: 600 },
      );

      const jpeg = await extractFirstFrame(videoUrl);
      const key = rec.thumbnail_path ?? thumbnailKeyFor(rec.user_id, rec.id);

      if (dryRun) {
        console.log(`~  would write ${jpeg.length}B → ${key}  | ${label}`);
        done += 1;
        continue;
      }

      await r2.send(
        new PutObjectCommand({
          Bucket: THUMBNAILS_BUCKET,
          Key: key,
          Body: jpeg,
          ContentType: "image/jpeg",
        }),
      );

      if (!rec.thumbnail_path) {
        const { error: updateError } = await supabase
          .from("recordings")
          .update({ thumbnail_path: key })
          .eq("id", rec.id);
        if (updateError) throw new Error(updateError.message);
      }

      console.log(`✓  ${jpeg.length}B → ${key}  | ${label}`);
      done += 1;
    } catch (e) {
      failed += 1;
      console.log(`✗  ${label}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone. ${done} updated, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
