"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { RemuxStatus } from "@/lib/types";

// While the upload is being remuxed to add a seek index, playback works but
// seeking is limited. Show a subtle chip and refresh until the worker finishes.
export function RemuxNotice({ status }: { status: RemuxStatus }) {
  const router = useRouter();
  const inProgress = status === "pending" || status === "processing";

  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [inProgress, router]);

  if (!inProgress) return null;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      Optimizing for smooth seeking…
    </div>
  );
}
