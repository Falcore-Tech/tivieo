import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { formatDuration } from "@/lib/utils";
import {
  RECORDINGS_BUCKET,
  THUMBNAILS_BUCKET,
  type Recording,
} from "@/lib/types";
import { VideoPlayer } from "./_components/video-player";
import { ShareBar } from "./_components/share-bar";

async function getRecording(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("recordings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Recording>();

  if (!data) return null;
  if (data.visibility === "private" && data.user_id !== user?.id) return null;
  return { recording: data, isOwner: data.user_id === user?.id };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getRecording(slug);
  if (!found) return { title: "Recording not found · Tivieo" };
  return { title: `${found.recording.title} · Tivieo` };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getRecording(slug);
  if (!found) notFound();

  const { recording, isOwner } = found;
  const admin = createAdminClient();
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
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <VideoPlayer
          src={signed.signedUrl}
          title={recording.title}
          poster={poster}
        />

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {recording.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(recording.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {recording.duration_seconds
                ? ` · ${formatDuration(recording.duration_seconds)}`
                : ""}
            </p>
          </div>

          <ShareBar
            slug={recording.slug}
            visibility={recording.visibility}
            isOwner={isOwner}
          />
        </div>
      </main>
    </>
  );
}
