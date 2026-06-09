"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ListTree,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { Chapter, ChaptersStatus } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { regenerateChapters } from "../_actions";
import { useVideoRef } from "./video-context";
import { ChapterEditor } from "./chapter-editor";

type Props = {
  status: ChaptersStatus;
  chapters: Chapter[] | null;
  isOwner: boolean;
  hasTranscript: boolean;
  slug: string;
};

export function ChaptersPanel({
  status,
  chapters,
  isOwner,
  hasTranscript,
  slug,
}: Props) {
  const videoRef = useVideoRef();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isStarting, startGeneration] = useTransition();

  const list = chapters ?? [];
  const inProgress = status === "pending" || status === "processing";

  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [inProgress, router]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || list.length === 0) return;
    function syncActive() {
      const t = video!.currentTime;
      let next = -1;
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].start <= t) next = i;
        else break;
      }
      setActiveIndex(next);
    }
    video.addEventListener("timeupdate", syncActive);
    return () => video.removeEventListener("timeupdate", syncActive);
  }, [videoRef, list]);

  function generate() {
    startGeneration(async () => {
      await regenerateChapters(slug);
      router.refresh();
    });
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play();
  }

  if (editing) {
    return (
      <ChapterEditor
        slug={slug}
        chapters={list}
        onClose={() => setEditing(false)}
      />
    );
  }

  if (inProgress) {
    return (
      <PanelShell>
        <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Generating chapters…
        </div>
      </PanelShell>
    );
  }

  if (list.length === 0) {
    if (!isOwner) return null;
    if (status === "error") {
      return (
        <PanelShell>
          <EmptyPrompt
            icon={RotateCw}
            message="Chapter generation failed."
            actionLabel="Retry"
            busy={isStarting}
            onAction={generate}
            secondaryLabel="Add manually"
            onSecondary={() => setEditing(true)}
          />
        </PanelShell>
      );
    }
    return (
      <PanelShell>
        {hasTranscript ? (
          <EmptyPrompt
            icon={Sparkles}
            message="No chapters yet. Generate them from the transcript."
            actionLabel="Generate chapters"
            busy={isStarting}
            onAction={generate}
            secondaryLabel="Add manually"
            onSecondary={() => setEditing(true)}
          />
        ) : (
          <EmptyPrompt
            icon={ListTree}
            message="Break this recording into chapters viewers can jump to."
            actionLabel="Add chapters"
            busy={false}
            onAction={() => setEditing(true)}
          />
        )}
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-base font-semibold">Chapters</h2>
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Chapter options"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {isStarting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit chapters
              </DropdownMenuItem>
              {hasTranscript ? (
                <DropdownMenuItem onSelect={generate} disabled={isStarting}>
                  <Sparkles className="size-4" /> Regenerate
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <ul className="max-h-96 space-y-1 overflow-y-auto py-1 lg:max-h-[calc(100svh-23rem)]">
        {list.map((chapter, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={`${chapter.start}-${index}`}>
              <button
                type="button"
                onClick={() => seekTo(chapter.start)}
                aria-current={isActive}
                className={cn(
                  "flex w-full gap-3 rounded-lg px-3 text-left transition-colors",
                  isActive ? "bg-secondary py-3" : "py-2.5 hover:bg-secondary/60",
                )}
              >
                <span
                  className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground"
                >
                  {formatDuration(chapter.start)}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span
                    className={cn(
                      "text-sm leading-snug",
                      isActive ? "font-semibold" : "font-medium",
                    )}
                  >
                    {chapter.title}
                  </span>
                  {isActive && chapter.description ? (
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {chapter.description}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}

function EmptyPrompt({
  icon: Icon,
  message,
  actionLabel,
  busy,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon: typeof ListTree;
  message: string;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ListTree className="size-4" />
        {message}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Icon className="size-3.5" />
          )}
          {actionLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}
