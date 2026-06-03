"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/password";
import type { Recording, RecordingVisibility } from "@/lib/types";

export async function setVisibility(
  slug: string,
  visibility: RecordingVisibility,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("recordings")
    .update({ visibility })
    .eq("slug", slug)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/v/${slug}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateTitle(slug: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return { error: "Title cannot be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("recordings")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/v/${slug}`);
  revalidatePath("/");
  return { ok: true, title: trimmed };
}

export async function updateSummary(slug: string, summary: string) {
  const trimmed = summary.trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("recordings")
    .update({
      transcript_summary: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/v/${slug}`);
  return { ok: true, summary: trimmed };
}

export async function requestTranscription(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Flip to `pending` (clearing any stale result). The recordings UPDATE-to-pending
  // trigger re-invokes the transcribe edge function. Idempotent: a row already
  // pending/processing won't re-cross the trigger transition.
  const { data, error } = await supabase
    .from("recordings")
    .update({
      transcript_status: "pending",
      transcript_text: null,
      transcript_segments: null,
      transcript_summary: null,
      transcript_topics: null,
      transcript_lang: null,
    })
    .eq("slug", slug)
    .eq("user_id", user.id)
    .not("transcript_status", "in", "(pending,processing)")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { error: error.message };
  if (!data) return { error: "Already transcribing, or not your recording." };

  revalidatePath(`/v/${slug}`);
  return { ok: true };
}

export async function recordView(slug: string) {
  const store = await cookies();
  const key = `tv_view_${slug}`;
  if (store.get(key)) return { ok: true };

  const admin = createAdminClient();
  await admin.rpc("increment_recording_view", { p_slug: slug });
  store.set(key, "1", {
    maxAge: 60 * 60 * 12,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return { ok: true };
}

export async function verifyRecordingPassword(slug: string, password: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recordings")
    .select("id, share_password_hash, deleted_at")
    .eq("slug", slug)
    .maybeSingle<
      Pick<Recording, "id" | "share_password_hash" | "deleted_at">
    >();
  if (!data || data.deleted_at) return { error: "Recording not found." };
  if (!data.share_password_hash) return { ok: true };
  if (!verifyPassword(password, data.share_password_hash)) {
    return { error: "Incorrect password." };
  }

  const store = await cookies();
  store.set(`tv_pw_${data.id}`, "1", {
    maxAge: 60 * 60 * 6,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return { ok: true };
}
