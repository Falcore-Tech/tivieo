import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { RECORDINGS_BUCKET, THUMBNAILS_BUCKET } from "@/lib/types";

type UploadArgs = {
  userId: string;
  blob: Blob;
  posterDataUrl: string | null;
  onProgress?: (fraction: number) => void;
};

type UploadResult = {
  storagePath: string;
  thumbnailPath: string | null;
  sizeBytes: number;
};

function uploadResumable(
  token: string,
  objectName: string,
  blob: Blob,
  onProgress?: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: RECORDINGS_BUCKET,
        objectName,
        contentType: "video/webm",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export async function uploadRecording({
  userId,
  blob,
  posterDataUrl,
  onProgress,
}: UploadArgs): Promise<UploadResult> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const id = crypto.randomUUID();
  const storagePath = `${userId}/${id}.webm`;
  await uploadResumable(token, storagePath, blob, onProgress);

  let thumbnailPath: string | null = null;
  if (posterDataUrl) {
    const posterBlob = await (await fetch(posterDataUrl)).blob();
    const path = `${userId}/${id}.jpg`;
    const { error } = await supabase.storage
      .from(THUMBNAILS_BUCKET)
      .upload(path, posterBlob, { contentType: "image/jpeg", upsert: true });
    if (!error) thumbnailPath = path;
  }

  return { storagePath, thumbnailPath, sizeBytes: blob.size };
}
