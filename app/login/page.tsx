import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "./_components/auth-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Video className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Tivieo</span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Sign in to record and share your screen.
        </p>

        <Suspense>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
