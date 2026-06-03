"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  MoreVertical,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import type { LibraryRecording } from "@/lib/types";
import { watchPath } from "./share-link";
import { useRecordingActions } from "./use-recording-actions";
import { VisibilityMenu } from "./visibility-menu";

type Props = {
  recording: LibraryRecording;
  scope: "active" | "trash";
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
};

export function RecordingCard({
  recording,
  scope,
  selectMode,
  selected,
  onToggleSelect,
}: Props) {
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const actions = useRecordingActions(recording.id, recording.slug);
  const isTrash = scope === "trash";
  const interactive = !selectMode && !isTrash;

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-neutral-950">
        {recording.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recording.thumbnailUrl}
            alt=""
            className={cn(
              "size-full object-cover transition-transform duration-300",
              interactive && "group-hover:scale-105",
              isTrash && "opacity-60",
            )}
          />
        ) : (
          <div className="size-full" />
        )}

        {interactive ? (
          <Link
            href={watchPath(recording.slug)}
            className="absolute inset-0 flex items-center justify-center bg-neutral-950/30 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Watch ${recording.title}`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-neutral-950">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </Link>
        ) : null}

        {selectMode ? (
          <button
            type="button"
            onClick={() => onToggleSelect(recording.id)}
            className="absolute inset-0 bg-neutral-950/20"
            aria-label={selected ? "Deselect recording" : "Select recording"}
          >
            <span className="absolute left-2 top-2">
              <Checkbox checked={selected} className="bg-card" />
            </span>
          </button>
        ) : null}

        {recording.duration_seconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-neutral-950/80 px-1.5 py-0.5 font-mono text-xs tabular-nums text-white">
            {formatDuration(recording.duration_seconds)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {interactive ? (
              <Link
                href={watchPath(recording.slug)}
                className="block truncate font-medium hover:underline"
              >
                {recording.title}
              </Link>
            ) : (
              <span className="block truncate font-medium">
                {recording.title}
              </span>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(recording.created_at).toLocaleDateString()}
              {recording.size_bytes
                ? ` · ${formatBytes(recording.size_bytes)}`
                : ""}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isTrash ? (
                <>
                  <DropdownMenuItem onSelect={() => actions.restore()}>
                    <RotateCcw className="size-4" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmingDestroy(true)}
                  >
                    <Trash2 className="size-4" /> Delete forever
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={watchPath(recording.slug)} target="_blank">
                      <ExternalLink className="size-4" /> Open in new tab
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/edit/${recording.slug}`}>
                      <Pencil className="size-4" /> Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.download()}>
                    <Download className="size-4" /> Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => actions.trash()}
                  >
                    <Trash2 className="size-4" /> Move to trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {recording.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {recording.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {!isTrash ? (
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <VisibilityMenu
                value={recording.visibility}
                onChange={actions.changeVisibility}
                disabled={actions.pending}
              />
              {recording.view_count > 0 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="size-3.5" />
                  {recording.view_count}
                </span>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => actions.copy()}>
              {actions.copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy link
            </Button>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmingDestroy} onOpenChange={setConfirmingDestroy}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the video, its thumbnail, and the share
              link. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                actions.destroy();
                setConfirmingDestroy(false);
              }}
              disabled={actions.pending}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
