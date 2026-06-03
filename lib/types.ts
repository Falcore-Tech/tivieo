export type RecordingVisibility = "public" | "unlisted" | "private";
export type RecordingStatus = "uploading" | "ready" | "error";

export type Recording = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  storage_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  visibility: RecordingVisibility;
  status: RecordingStatus;
  created_at: string;
};

export const RECORDINGS_BUCKET = "recordings";
export const THUMBNAILS_BUCKET = "thumbnails";
