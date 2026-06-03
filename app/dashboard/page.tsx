import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { THUMBNAILS_BUCKET, type Recording } from "@/lib/types";
import { RecordingCard } from "./_components/recording-card";
import { EmptyState } from "./_components/empty-state";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Recording[]>();

  const recordings = data ?? [];
  const admin = createAdminClient();
  const thumbnailFor = (recording: Recording) =>
    recording.thumbnail_path
      ? admin.storage
          .from(THUMBNAILS_BUCKET)
          .getPublicUrl(recording.thumbnail_path).data.publicUrl
      : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your recordings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {recordings.length} recording{recordings.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button asChild>
            <Link href="/record">
              <Plus className="size-4" /> New recording
            </Link>
          </Button>
        </div>

        {recordings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                thumbnailUrl={thumbnailFor(recording)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
