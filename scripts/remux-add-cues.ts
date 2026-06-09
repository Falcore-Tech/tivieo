/**
 * Backfill: remux every recording's webm with `ffmpeg -c copy` to add a Cues
 * seek index. MediaRecorder output has no Cues, so browsers can only seek within
 * buffered data; this lossless remux (no re-encode) makes the video seekable to
 * any position. Run once after recordings already exist.
 *
 *   bun --env-file=.env.local scripts/remux-add-cues.ts
 *
 * Add --dry to list what would change without writing.
 * Needs ffmpeg on PATH plus the R2 + Supabase service-role env vars.
 */
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Remux the presigned URL straight into a real temp file (NOT a pipe): the webm
// muxer must seek back over a real file to write the SeekHead + Cues index.
function remuxToFile(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-loglevel",
      "error",
      "-y",
      "-i",
      url,
      "-c",
      "copy",
      outPath,
    ]);
    const errChunks: Buffer[] = [];
    ff.stderr.on("data", (d) => errChunks.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
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
    .select("id, storage_path, title")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  if (!recordings?.length) {
    console.log("No recordings found.");
    return;
  }

  console.log(`${recordings.length} recording(s)${dryRun ? " (dry run)" : ""}\n`);

  let done = 0;
  let failed = 0;
  for (const rec of recordings) {
    const label = `${rec.title ?? "untitled"} (${rec.id})`;
    if (!rec.storage_path) {
      console.log(`-  skip, no video: ${label}`);
      continue;
    }
    const outPath = join(tmpdir(), `remux-${rec.id}.webm`);
    try {
      const videoUrl = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: VIDEOS_BUCKET,
          Key: rec.storage_path,
        }),
        { expiresIn: 3600 },
      );

      if (dryRun) {
        console.log(`~  would remux → ${rec.storage_path}  | ${label}`);
        done += 1;
        continue;
      }

      await remuxToFile(videoUrl, outPath);
      const body = await readFile(outPath);

      await r2.send(
        new PutObjectCommand({
          Bucket: VIDEOS_BUCKET,
          Key: rec.storage_path,
          Body: body,
          ContentType: "video/webm",
        }),
      );

      await supabase
        .from("recordings")
        .update({ remux_status: "ready" })
        .eq("id", rec.id);

      console.log(`✓  ${body.length}B → ${rec.storage_path}  | ${label}`);
      done += 1;
    } catch (e) {
      failed += 1;
      console.log(`✗  ${label}: ${e instanceof Error ? e.message : e}`);
    } finally {
      await unlink(outPath).catch(() => {});
    }
  }

  console.log(`\nDone. ${done} updated, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
