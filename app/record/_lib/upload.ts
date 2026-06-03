import axios from "axios";
import { createUploadTarget } from "../_actions";

type UploadArgs = {
  blob: Blob;
  onProgress?: (fraction: number) => void;
};

type UploadResult = {
  storagePath: string;
  userId: string;
  recordingId: string;
  sizeBytes: number;
};

export async function uploadRecording({
  blob,
  onProgress,
}: UploadArgs): Promise<UploadResult> {
  const target = await createUploadTarget();
  if ("error" in target) throw new Error(target.error);

  // Content-Type must exactly match the type signed into the presigned PUT URL
  // (video/webm) or R2 rejects with SignatureDoesNotMatch.
  await axios.put(target.uploadUrl, blob, {
    headers: { "Content-Type": "video/webm" },
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(event.loaded / event.total);
    },
  });

  return {
    storagePath: target.videoKey,
    userId: target.userId,
    recordingId: target.recordingId,
    sizeBytes: blob.size,
  };
}
