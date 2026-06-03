import Link from "next/link";
import { VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RecordingNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <VideoOff className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        Recording not found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This recording doesn&apos;t exist, was deleted, or is private.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
