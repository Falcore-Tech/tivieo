import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { RecorderStudio } from "./_components/recorder-studio";

export default async function RecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/record");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            New recording
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your screen, position your camera bubble, and hit record.
          </p>
        </div>
        <RecorderStudio />
      </main>
    </>
  );
}
