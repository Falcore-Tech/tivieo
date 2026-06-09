import Link from "next/link";
import { ChevronDown, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export async function SiteHeader({
  containerClassName,
  actions,
  minimal = false,
  title,
}: {
  containerClassName?: string;
  actions?: React.ReactNode;
  minimal?: boolean;
  title?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-page items-center justify-between gap-4 px-4 sm:px-6 lg:px-8",
          containerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Video className="size-4" />
            </span>
            <span className="font-semibold tracking-tight max-sm:hidden">
              Tivieo
            </span>
          </Link>
          {title ? (
            <>
              <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-sm font-medium">{title}</span>
              </span>
            </>
          ) : null}
        </div>

        <nav className="flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
          {minimal ? null : user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/">Library</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/record">New recording</Link>
              </Button>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
