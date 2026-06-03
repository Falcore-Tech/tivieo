"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  RECORDINGS_BUCKET,
  THUMBNAILS_BUCKET,
  type Recording,
} from "@/lib/types";

export async function renameRecording(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return { error: "Title cannot be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("recordings")
    .update({ title: trimmed })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRecording(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: recording } = await supabase
    .from("recordings")
    .select("storage_path, thumbnail_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<Pick<Recording, "storage_path" | "thumbnail_path">>();

  if (recording) {
    await supabase.storage
      .from(RECORDINGS_BUCKET)
      .remove([recording.storage_path]);
    if (recording.thumbnail_path) {
      await supabase.storage
        .from(THUMBNAILS_BUCKET)
        .remove([recording.thumbnail_path]);
    }
  }

  const { error } = await supabase
    .from("recordings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
