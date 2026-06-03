import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  RECORDINGS_BUCKET,
  THUMBNAILS_BUCKET,
  type Collection,
  type Recording,
} from "@/lib/types";
import { EditForm } from "./_components/edit-form";

export const metadata: Metadata = { title: "Edit recording · Tivieo" };

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/edit/${slug}`);

  const { data: recording } = await supabase
    .from("recordings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Recording>();
  if (!recording || recording.user_id !== user.id) notFound();

  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<Collection[]>();

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(recording.storage_path, 60 * 60 * 2);
  const thumbnailUrl = recording.thumbnail_path
    ? admin.storage
        .from(THUMBNAILS_BUCKET)
        .getPublicUrl(recording.thumbnail_path).data.publicUrl
    : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link href="/">
            <ArrowLeft className="size-4" /> Back to library
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit recording</h1>
        <EditForm
          recording={recording}
          collections={collections ?? []}
          userId={user.id}
          videoUrl={signed?.signedUrl ?? null}
          thumbnailUrl={thumbnailUrl}
        />
      </main>
    </>
  );
}
