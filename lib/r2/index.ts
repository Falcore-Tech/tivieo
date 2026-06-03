import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID!;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const VIDEOS_BUCKET = process.env.R2_VIDEOS_BUCKET!;
const THUMBNAILS_BUCKET = process.env.R2_THUMBNAILS_BUCKET!;
const THUMBNAILS_PUBLIC_URL = (process.env.R2_THUMBNAILS_PUBLIC_URL ?? "").replace(
  /\/$/,
  "",
);

type R2Bucket = "videos" | "thumbnails";

function bucketName(bucket: R2Bucket) {
  return bucket === "videos" ? VIDEOS_BUCKET : THUMBNAILS_BUCKET;
}

// Presigned PUT for the private videos bucket — the browser uploads the webm
// directly. The Content-Type sent on the PUT must match `contentType` exactly
// or R2 rejects the request with SignatureDoesNotMatch.
export function presignPutUrl(key: string, contentType: string, ttlSeconds = 600) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: VIDEOS_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: ttlSeconds },
  );
}

// Presigned GET for private video playback / download. R2 honors HTTP range
// requests on these URLs, so the <video> scrubber works.
export function presignGetUrl(
  key: string,
  ttlSeconds = 60 * 60 * 2,
  opts?: { downloadFilename?: string },
) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: VIDEOS_BUCKET,
      Key: key,
      ...(opts?.downloadFilename
        ? {
            ResponseContentDisposition: `attachment; filename="${opts.downloadFilename}"`,
          }
        : {}),
    }),
    { expiresIn: ttlSeconds },
  );
}

// Stable public URL for a thumbnail (R2 r2.dev subdomain or custom domain).
export function publicThumbnailUrl(key: string) {
  return `${THUMBNAILS_PUBLIC_URL}/${key}`;
}

// Server-side upload of a thumbnail to the public bucket. The browser never
// holds R2 write credentials, so thumbnails are put from server actions.
export async function putThumbnail(
  key: string,
  body: Uint8Array,
  contentType = "image/jpeg",
) {
  await r2.send(
    new PutObjectCommand({
      Bucket: THUMBNAILS_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObjects(bucket: R2Bucket, keys: string[]) {
  if (keys.length === 0) return;
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: bucketName(bucket),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

export const r2Keys = {
  video: (userId: string, id: string) => `${userId}/${id}.webm`,
  thumbnail: (userId: string, id: string) => `${userId}/${id}.jpg`,
};

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
