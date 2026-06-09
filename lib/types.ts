export type RecordingVisibility = "public" | "unlisted" | "private";
export type RecordingStatus = "uploading" | "ready" | "error";
export type RemuxStatus = "pending" | "processing" | "ready" | "error";
export type TranscriptStatus =
  | "none"
  | "pending"
  | "processing"
  | "ready"
  | "error";

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
  speaker?: number;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  words?: TranscriptWord[];
};

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
  remux_status: RemuxStatus;
  remux_attempts: number;
  transcript_status: TranscriptStatus;
  transcript_lang: string | null;
  transcript_text: string | null;
  transcript_segments: TranscriptSegment[] | null;
  transcript_summary: string | null;
  transcript_topics: string[] | null;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type LibraryRecording = Recording & { thumbnailUrl: string | null };
