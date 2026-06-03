import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  THUMBNAILS_BUCKET,
  type Collection,
  type LibraryRecording,
  type Recording,
} from "@/lib/types";
import { LibraryShell } from "./library-shell";

export async function Library({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: recordingRows }, { data: collectionRows }] = await Promise.all([
    supabase
      .from("recordings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<Recording[]>(),
    supabase
      .from("collections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<Collection[]>(),
  ]);

  const recordings = recordingRows ?? [];
  const collections = collectionRows ?? [];
  const admin = createAdminClient();

  const items: LibraryRecording[] = recordings.map((recording) => ({
    ...recording,
    tags: recording.tags ?? [],
    view_count: recording.view_count ?? 0,
    deleted_at: recording.deleted_at ?? null,
    collection_id: recording.collection_id ?? null,
    thumbnailUrl: recording.thumbnail_path
      ? admin.storage
          .from(THUMBNAILS_BUCKET)
          .getPublicUrl(recording.thumbnail_path).data.publicUrl
      : null,
  }));

  const storageUsedBytes = recordings.reduce(
    (total, recording) => total + (recording.size_bytes ?? 0),
    0,
  );

  return (
    <LibraryShell
      recordings={items}
      collections={collections}
      storageUsedBytes={storageUsedBytes}
    />
  );
}
