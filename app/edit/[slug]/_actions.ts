"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  putThumbnail,
  publicThumbnailUrl,
  deleteObjects,
  dataUrlToBytes,
  r2Keys,
} from "@/lib/r2";
import { slugify } from "@/lib/utils";
import { hashPassword } from "@/lib/password";
import { type Recording, type RecordingVisibility } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const now = () => new Date().toISOString();

type UpdateInput = {
  title: string;
  visibility: RecordingVisibility;
  collectionId: string | null;
  tags: string[];
};

export async function updateRecording(id: string, input: UpdateInput) {
  const title = input.title.trim();
  if (!title) return { error: "Title cannot be empty." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const tags = Array.from(
    new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
  ).slice(0, 20);

  const { error } = await supabase
    .from("recordings")
    .update({
      title,
      visibility: input.visibility,
      collection_id: input.collectionId,
      tags,
      updated_at: now(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function changeSlug(id: string, desired: string) {
  const next = slugify(desired);
  if (!next) {
    return { error: "Use letters, numbers, and hyphens for the link." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { data: current } = await supabase
    .from("recordings")
    .select("slug")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<Pick<Recording, "slug">>();
  if (!current) return { error: "Recording not found." };
  if (current.slug === next) return { ok: true, slug: next };

  const { error } = await supabase
    .from("recordings")
    .update({ slug: next, updated_at: now() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That link is already taken." };
    return { error: error.message };
  }

  const admin = createAdminClient();
  await admin.from("recording_aliases").delete().eq("old_slug", next);
  await admin
    .from("recording_aliases")
    .upsert({ old_slug: current.slug, recording_id: id });

  revalidatePath("/");
  return { ok: true, slug: next };
}

export async function setThumbnail(id: string, posterDataUrl: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("recordings")
    .select("thumbnail_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<Pick<Recording, "thumbnail_path">>();

  const key = r2Keys.thumbnail(user.id, crypto.randomUUID());
  await putThumbnail(key, dataUrlToBytes(posterDataUrl));

  const { error } = await supabase
    .from("recordings")
    .update({ thumbnail_path: key, updated_at: now() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  if (existing?.thumbnail_path && existing.thumbnail_path !== key) {
    await deleteObjects("thumbnails", [existing.thumbnail_path]);
  }

  revalidatePath("/");
  return { ok: true, url: publicThumbnailUrl(key) };
}

export async function setSharePassword(id: string, password: string | null) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const value = password?.trim() ? hashPassword(password.trim()) : null;
  const { error } = await supabase
    .from("recordings")
    .update({ share_password_hash: value, updated_at: now() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function setExpiry(id: string, expiresAt: string | null) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  let value: string | null = null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return { error: "Invalid date." };
    value = parsed.toISOString();
  }

  const { error } = await supabase
    .from("recordings")
    .update({ expires_at: value, updated_at: now() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}
