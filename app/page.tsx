import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Landing } from "./_components/landing";
import { Library } from "./_components/library";
import { GridSkeleton } from "./_components/grid-skeleton";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader />
      {user ? (
        <Suspense fallback={<GridSkeleton />}>
          <Library userId={user.id} />
        </Suspense>
      ) : (
        <Landing />
      )}
    </>
  );
}
