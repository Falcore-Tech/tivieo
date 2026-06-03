"use server";

import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import {
  presignPutUrl,
  putThumbnail,
  dataUrlToBytes,
  r2Keys,
} from "@/lib/r2";

const slugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

export async function createUploadTarget() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const recordingId = crypto.randomUUID();
  const videoKey = r2Keys.video(user.id, recordingId);
  const uploadUrl = await presignPutUrl(videoKey, "video/webm");
  return { uploadUrl, videoKey, recordingId, userId: user.id };
}

type CreateRecordingInput = {
  title: string;
  storagePath: string;
  posterDataUrl: string | null;
  userId: string;
  recordingId: string;
  durationSeconds: number;
  sizeBytes: number;
};

export async function createRecording(input: CreateRecordingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== input.userId) {
    return { error: "You must be signed in." };
  }

  let thumbnailPath: string | null = null;
  if (input.posterDataUrl) {
    const thumbnailKey = r2Keys.thumbnail(user.id, input.recordingId);
    try {
      await putThumbnail(thumbnailKey, dataUrlToBytes(input.posterDataUrl));
      thumbnailPath = thumbnailKey;
    } catch {
      // Non-fatal: the recording still saves without a thumbnail.
    }
  }

  const title = input.title.trim() || "Untitled recording";
  const base = slugify(title) || "recording";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = `${base}-${slugSuffix()}`;
    const { error } = await supabase.from("recordings").insert({
      user_id: user.id,
      title,
      slug,
      storage_path: input.storagePath,
      thumbnail_path: thumbnailPath,
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
