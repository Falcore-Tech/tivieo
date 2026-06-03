import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpired } from "@/lib/utils";
import {
  RECORDINGS_BUCKET,
  THUMBNAILS_BUCKET,
  type Recording,
} from "@/lib/types";
import { VideoPlayer } from "../../v/[slug]/_components/video-player";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: recording } = await admin
    .from("recordings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Recording>();

  if (
    !recording ||
    recording.deleted_at ||
    recording.visibility === "private" ||
    recording.share_password_hash ||
    isExpired(recording.expires_at)
  ) {
    notFound();
  }

  const { data: signed } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(recording.storage_path, 60 * 60 * 2);
  if (!signed?.signedUrl) notFound();

  const poster = recording.thumbnail_path
    ? admin.storage
        .from(THUMBNAILS_BUCKET)
        .getPublicUrl(recording.thumbnail_path).data.publicUrl
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950">
      <VideoPlayer
        src={signed.signedUrl}
        title={recording.title}
        poster={poster}
      />
    </main>
  );
}
