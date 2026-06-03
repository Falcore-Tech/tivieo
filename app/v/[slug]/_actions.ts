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
