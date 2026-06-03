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
import { cn, formatDuration } from "@/lib/utils";
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

export function RecordingRow({
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
        "flex items-center gap-3 rounded-lg border px-2.5 py-2",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      {selectMode ? (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(recording.id)}
          aria-label={selected ? "Deselect recording" : "Select recording"}
        />
      ) : null}

      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-neutral-950">
        {recording.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recording.thumbnailUrl}
            alt=""
            className={cn("size-full object-cover", isTrash && "opacity-60")}
          />
        ) : null}
        {interactive ? (
          <Link
            href={watchPath(recording.slug)}
            className="absolute inset-0 flex items-center justify-center bg-neutral-950/20 opacity-0 transition-opacity hover:opacity-100"
            aria-label={`Watch ${recording.title}`}
          >
            <Play className="size-4 fill-current text-white" />
          </Link>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {interactive ? (
          <Link
            href={watchPath(recording.slug)}
            className="block truncate text-sm font-medium hover:underline"
          >
            {recording.title}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">
            {recording.title}
          </span>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{new Date(recording.created_at).toLocaleDateString()}</span>
          {recording.duration_seconds ? (
            <span className="font-mono tabular-nums">
              {formatDuration(recording.duration_seconds)}
            </span>
          ) : null}
          {recording.view_count > 0 ? (
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {recording.view_count}
            </span>
          ) : null}
          {recording.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {!isTrash ? (
        <div className="hidden items-center gap-2 sm:flex">
          <VisibilityMenu
            value={recording.visibility}
            onChange={actions.changeVisibility}
            disabled={actions.pending}
          />
          <Button variant="ghost" size="sm" onClick={() => actions.copy()}>
            {actions.copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            Copy
          </Button>
        </div>
      ) : null}

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
