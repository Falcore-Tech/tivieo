import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { presignGetUrl, publicThumbnailUrl } from "@/lib/r2";
import { isExpired } from "@/lib/utils";
import { type Recording } from "@/lib/types";
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

  const videoUrl = await presignGetUrl(recording.storage_path, 60 * 60 * 2);

  const poster = recording.thumbnail_path
    ? publicThumbnailUrl(recording.thumbnail_path)
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-video-surface">
      <VideoPlayer src={videoUrl} title={recording.title} poster={poster} />
    </main>
  );
}
