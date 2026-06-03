import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarX, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { presignGetUrl, publicThumbnailUrl } from "@/lib/r2";
import { SiteHeader } from "@/components/site-header";
import { formatDuration, isExpired } from "@/lib/utils";
import { type Recording } from "@/lib/types";
import { VideoProvider } from "./_components/video-context";
import { VideoPlayer } from "./_components/video-player";
import { TranscriptInsights } from "./_components/transcript-insights";
import { TranscriptPanel } from "./_components/transcript-panel";
import { ShareBar } from "./_components/share-bar";
import { ViewBeacon } from "./_components/view-beacon";
import { PasswordGate } from "./_components/password-gate";

async function fetchBySlug(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("recordings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Recording>();
  return { user, recording: data, admin };
}

function isVisibleTo(recording: Recording, userId: string | undefined) {
  if (recording.deleted_at) return false;
  if (recording.visibility === "private") return recording.user_id === userId;
  return true;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { user, recording } = await fetchBySlug(slug);
  if (!recording || !isVisibleTo(recording, user?.id)) {
    return { title: "Recording not found · Tivieo" };
  }
  return { title: `${recording.title} · Tivieo` };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, recording, admin } = await fetchBySlug(slug);

  if (!recording) {
    const { data: alias } = await admin
      .from("recording_aliases")
      .select("recording_id")
      .eq("old_slug", slug)
      .maybeSingle<{ recording_id: string }>();
    if (alias) {
      const { data: target } = await admin
        .from("recordings")
        .select("slug, deleted_at")
        .eq("id", alias.recording_id)
        .maybeSingle<Pick<Recording, "slug" | "deleted_at">>();
      if (target && !target.deleted_at) permanentRedirect(`/v/${target.slug}`);
    }
    notFound();
  }

  const isOwner = recording.user_id === user?.id;
  if (!isVisibleTo(recording, user?.id)) notFound();

  const expired = isExpired(recording.expires_at);

  if (expired && !isOwner) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <CalendarX className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">This link has expired</h1>
          <p className="text-sm text-muted-foreground">
            The owner set this recording to stop being shareable.
          </p>
        </main>
      </>
    );
  }

  const needsPassword = Boolean(recording.share_password_hash) && !isOwner;
  if (needsPassword) {
    const store = await cookies();
    if (!store.get(`tv_pw_${recording.id}`)) {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
            <PasswordGate slug={recording.slug} />
          </main>
        </>
      );
    }
  }

  const videoUrl = await presignGetUrl(recording.storage_path, 60 * 60 * 2);

  const poster = recording.thumbnail_path
    ? publicThumbnailUrl(recording.thumbnail_path)
    : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <VideoProvider>
          <VideoPlayer
            src={videoUrl}
            title={recording.title}
            poster={poster}
            captionsSrc={
              recording.transcript_status === "ready"
                ? `/v/${recording.slug}/captions`
                : null
            }
          />

          <div className="mt-5 flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {recording.title}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span>
                  {new Date(recording.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {recording.duration_seconds ? (
                  <span>· {formatDuration(recording.duration_seconds)}</span>
                ) : null}
                {isOwner ? (
                  <span className="inline-flex items-center gap-1">
                    · <Eye className="size-3.5" /> {recording.view_count} views
                  </span>
                ) : null}
              </p>
            </div>

            <ShareBar
              slug={recording.slug}
              title={recording.title}
              visibility={recording.visibility}
              isOwner={isOwner}
            />

            <TranscriptInsights
              status={recording.transcript_status}
              summary={recording.transcript_summary}
              topics={recording.transcript_topics}
            />

            <TranscriptPanel
              status={recording.transcript_status}
              segments={recording.transcript_segments}
              isOwner={isOwner}
              slug={recording.slug}
            />
          </div>
        </VideoProvider>
      </main>

      {!isOwner ? <ViewBeacon slug={recording.slug} /> : null}
    </>
  );
}
