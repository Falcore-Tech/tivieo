import Link from "next/link";
import { MonitorUp, Share2, Sparkles, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: MonitorUp,
    title: "Capture screen + camera",
    body: "Share any tab, window, or screen with your webcam framed in a bubble on top.",
  },
  {
    icon: Share2,
    title: "Get an instant link",
    body: "Stop recording and your video uploads automatically with a clean, shareable link.",
  },
  {
    icon: UserRound,
    title: "Watch anywhere",
    body: "Recipients press play in a polished player — no account or download required.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Screen recording, made shareable
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Record your screen and webcam in one click
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Tivieo captures your screen with a camera bubble, then hands you a
            unique link to a beautiful video player. No editing, no friction.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={user ? "/record" : "/login?next=/record"}>
                Start recording
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={user ? "/dashboard" : "/login"}>
                {user ? "Go to dashboard" : "Sign in"}
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
