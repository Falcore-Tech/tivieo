"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RECORDINGS_BUCKET,
  THUMBNAILS_BUCKET,
  type Collection,
  type Recording,
  type RecordingVisibility,
} from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const now = () => new Date().toISOString();

export async function setRecordingVisibility(
  id: string,
  visibility: RecordingVisibility,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase
    .from("recordings")
    .update({ visibility, updated_at: now() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function bulkSetVisibility(
  ids: string[],
  visibility: RecordingVisibility,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (ids.length === 0) return { ok: true };
  const { error } = await supabase
    .from("recordings")
    .update({ visibility, updated_at: now() })
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function softDeleteRecordings(ids: string[]) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (ids.length === 0) return { ok: true };
  const { error } = await supabase
    .from("recordings")
    .update({ deleted_at: now() })
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function restoreRecordings(ids: string[]) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (ids.length === 0) return { ok: true };
  const { error } = await supabase
    .from("recordings")
    .update({ deleted_at: null })
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteRecordingsForever(ids: string[]) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (ids.length === 0) return { ok: true };

  const { data: rows } = await supabase
    .from("recordings")
    .select("storage_path, thumbnail_path")
    .in("id", ids)
    .eq("user_id", user.id)
    .returns<Pick<Recording, "storage_path" | "thumbnail_path">[]>();

  if (rows && rows.length > 0) {
    const videoPaths = rows.map((row) => row.storage_path);
    const thumbPaths = rows
      .map((row) => row.thumbnail_path)
      .filter((path): path is string => Boolean(path));
    await supabase.storage.from(RECORDINGS_BUCKET).remove(videoPaths);
    if (thumbPaths.length > 0) {
      await supabase.storage.from(THUMBNAILS_BUCKET).remove(thumbPaths);
    }
  }

  const { error } = await supabase
    .from("recordings")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createCollection(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name cannot be empty." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: trimmed })
    .select("*")
    .single<Collection>();
  if (error) return { error: error.message };
  revalidatePath("/");
  return { collection: data };
}

export async function renameCollection(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Folder name cannot be empty." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase
    .from("collections")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCollection(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function moveToCollection(
  ids: string[],
  collectionId: string | null,
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (ids.length === 0) return { ok: true };
  const { error } = await supabase
    .from("recordings")
    .update({ collection_id: collectionId, updated_at: now() })
    .in("id", ids)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function getDownloadUrl(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const { data: recording } = await supabase
    .from("recordings")
    .select("storage_path, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<Pick<Recording, "storage_path" | "title">>();
  if (!recording) return { error: "Recording not found." };

  const admin = createAdminClient();
  const filename = `${recording.title || "recording"}.webm`;
  const { data, error } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(recording.storage_path, 60 * 5, { download: filename });
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not create download link." };
  }
  return { url: data.signedUrl };
}
