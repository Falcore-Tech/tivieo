import Link from "next/link";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Video className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">No recordings yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record your screen and camera to create your first shareable link.
        </p>
      </div>
      <Button asChild>
        <Link href="/record">Create a recording</Link>
      </Button>
    </div>
  );
}
