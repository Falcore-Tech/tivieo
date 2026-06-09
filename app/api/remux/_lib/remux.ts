import "server-only";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { presignGetUrl, putVideo } from "@/lib/r2";

// Remux a presigned URL straight into a real temp file (NOT a pipe): the webm
// muxer must seek back over a real file to write the SeekHead + Cues index.
function remuxToFile(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static binary not found"));
      return;
    }
    const ff = spawn(ffmpegPath, [
      "-loglevel",
      "error",
      "-y",
      "-i",
      url,
      "-c",
      "copy",
      outPath,
    ]);
    const err: Buffer[] = [];
    ff.stderr.on("data", (d) => err.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().trim()}`),
        );
    });
  });
}

// Download → remux (adds Cues) → overwrite the same R2 key in place.
export async function remuxRecordingVideo(recordingId: string, storagePath: string) {
  const outPath = join(tmpdir(), `remux-${recordingId}.webm`);
  try {
    const url = await presignGetUrl(storagePath, 3600);
    await remuxToFile(url, outPath);
    const body = await readFile(outPath);
    if (!body.length) throw new Error("remux produced an empty file");
    await putVideo(storagePath, new Uint8Array(body));
  } finally {
    await unlink(outPath).catch(() => {});
  }
}
