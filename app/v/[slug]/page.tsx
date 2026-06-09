import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { presignGetUrl, publicThumbnailUrl } from "@/lib/r2";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  absoluteDate,
  formatDuration,
  formatRelativeDate,
  isExpired,
} from "@/lib/utils";
import { type Recording } from "@/lib/types";
import { VideoProvider } from "./_components/video-context";
import { VideoPlayer } from "./_components/video-player";
import { EditableTitle } from "./_components/editable-title";
import { RecordingSummary } from "./_components/recording-summary";
import { TranscriptPanel } from "./_components/transcript-panel";
import { ShareBar } from "./_components/share-bar";
import { WatchActions } from "./_components/watch-actions";
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

  const hasTranscriptTab = !(
    recording.transcript_status === "none" && !isOwner
  );

  return (
    <>
      <SiteHeader
        minimal
        title={recording.title}
        actions={
          <>
            {user ? (
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href="/record">
                  <Plus className="size-4" /> Record
                </Link>
              </Button>
            ) : null}
            <WatchActions slug={recording.slug} title={recording.title} />
          </>
        }
      />
      <main className="mx-auto w-full max-w-page flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <VideoProvider>
          {expired && isOwner ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm text-warning-700 dark:text-warning-300">
              <CalendarX className="size-4 shrink-0" />
              <span>
                This link has expired. Only you can see this page; viewers get an
                expired notice.
              </span>
            </div>
          ) : null}

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-8">
            <div className="min-w-0">
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
            </div>

            <aside className="mt-5 flex flex-col gap-4 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
              <div className="flex flex-col gap-1.5">
                <EditableTitle
                  slug={recording.slug}
                  value={recording.title}
                  canEdit={isOwner}
                />
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span title={absoluteDate(recording.created_at)}>
                    {formatRelativeDate(recording.created_at)}
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
                visibility={recording.visibility}
                isOwner={isOwner}
              />

              {hasTranscriptTab ? (
                <Tabs defaultValue="summary" className="gap-3">
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="summary"
                      className="flex-1 data-active:bg-card data-active:shadow-sm dark:data-active:bg-neutral-700"
                    >
                      Summary
                    </TabsTrigger>
                    <TabsTrigger
                      value="transcript"
                      className="flex-1 data-active:bg-card data-active:shadow-sm dark:data-active:bg-neutral-700"
                    >
                      Transcript
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="summary">
                    <RecordingSummary
                      slug={recording.slug}
                      summary={recording.transcript_summary}
                      topics={recording.transcript_topics}
                      canEdit={isOwner}
                    />
                  </TabsContent>
                  <TabsContent value="transcript">
                    <TranscriptPanel
                      status={recording.transcript_status}
                      segments={recording.transcript_segments}
                      isOwner={isOwner}
                      slug={recording.slug}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <RecordingSummary
                  slug={recording.slug}
                  summary={recording.transcript_summary}
                  topics={recording.transcript_topics}
                  canEdit={isOwner}
                />
              )}
            </aside>
          </div>
        </VideoProvider>
      </main>

      {!isOwner ? <ViewBeacon slug={recording.slug} /> : null}
    </>
  );
}
