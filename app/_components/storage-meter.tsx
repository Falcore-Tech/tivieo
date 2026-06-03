import { HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/utils";

const QUOTA_BYTES = 5 * 1024 ** 3;

export function StorageMeter({ usedBytes }: { usedBytes: number }) {
  const ratio = Math.min(1, usedBytes / QUOTA_BYTES);
  const percent = Math.round(ratio * 100);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <HardDrive className="size-3.5" /> Storage
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {formatBytes(usedBytes)} of {formatBytes(QUOTA_BYTES)}
      </p>
    </div>
  );
}
