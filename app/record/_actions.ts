"use server";

import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const slugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

type CreateRecordingInput = {
  title: string;
  storagePath: string;
  thumbnailPath: string | null;
  durationSeconds: number;
  sizeBytes: number;
};

export async function createRecording(input: CreateRecordingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const title = input.title.trim() || "Untitled recording";
  const base = slugify(title) || "recording";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = `${base}-${slugSuffix()}`;
    const { error } = await supabase.from("recordings").insert({
      user_id: user.id,
      title,
      slug,
      storage_path: input.storagePath,
      thumbnail_path: input.thumbnailPath,
      duration_seconds: input.durationSeconds,
      size_bytes: input.sizeBytes,
      status: "ready",
      transcript_status: "pending",
    });

    if (!error) {
      revalidatePath("/");
      return { slug };
    }
    if (error.code !== "23505") return { error: error.message };
  }

  return { error: "Could not generate a unique link. Try again." };
}
