"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RecordingVisibility } from "@/lib/types";

export async function setVisibility(slug: string, visibility: RecordingVisibility) {
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
  revalidatePath("/dashboard");
  return { ok: true };
}
