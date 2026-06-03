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
  updated_at: string;
  deleted_at: string | null;
  view_count: number;
  collection_id: string | null;
  tags: string[];
  share_password_hash: string | null;
  expires_at: string | null;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type LibraryRecording = Recording & { thumbnailUrl: string | null };

export const RECORDINGS_BUCKET = "recordings";
export const THUMBNAILS_BUCKET = "thumbnails";
