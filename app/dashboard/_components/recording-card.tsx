"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Globe,
  Link2,
  Lock,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils";
import type { Recording, RecordingVisibility } from "@/lib/types";
import { deleteRecording } from "../_actions";
import { RenameDialog } from "./rename-dialog";

const VISIBILITY: Record<RecordingVisibility, { label: string; icon: typeof Globe }> =
  {
    public: { label: "Public", icon: Globe },
    unlisted: { label: "Unlisted", icon: Link2 },
    private: { label: "Private", icon: Lock },
  };

type Props = {
  recording: Recording;
  thumbnailUrl: string | null;
};

export function RecordingCard({ recording, thumbnailUrl }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const Meta = VISIBILITY[recording.visibility];

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecording(recording.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recording deleted");
      setConfirmingDelete(false);
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link
        href={`/v/${recording.slug}`}
        className="relative block aspect-video overflow-hidden bg-neutral-950"
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="size-full" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-neutral-950/30 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-neutral-950">
            <Play className="size-5 translate-x-px fill-current" />
          </span>
        </span>
        {recording.duration_seconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-neutral-950/80 px-1.5 py-0.5 font-mono text-xs text-white tabular-nums">
            {formatDuration(recording.duration_seconds)}
          </span>
        ) : null}
      </Link>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <Link
            href={`/v/${recording.slug}`}
            className="block truncate font-medium hover:underline"
          >
            {recording.title}
          </Link>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Meta.icon className="size-3" />
              {Meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(recording.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil className="size-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameDialog
        id={recording.id}
        currentTitle={recording.title}
        open={renaming}
        onOpenChange={setRenaming}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the video and its share link. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={pending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
