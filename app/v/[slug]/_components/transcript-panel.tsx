"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  RotateCw,
  Search,
  Sparkles,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { TranscriptSegment, TranscriptStatus } from "@/lib/types";
import { requestTranscription } from "../_actions";
import { useVideoRef } from "./video-context";

type Props = {
  status: TranscriptStatus;
  segments: TranscriptSegment[] | null;
  isOwner: boolean;
  slug: string;
};

export function TranscriptPanel({ status, segments, isOwner, slug }: Props) {
  const videoRef = useVideoRef();
  const router = useRouter();
  const [isStarting, startTranscription] = useTransition();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const inProgress = status === "pending" || status === "processing";

  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [inProgress, router]);

  const indexed = useMemo(
    () => (segments ?? []).map((segment, index) => ({ segment, index })),
    [segments],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return indexed;
    return indexed.filter((item) =>
      item.segment.text.toLowerCase().includes(term),
    );
  }, [indexed, query]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;
    function syncActive() {
      const t = video!.currentTime;
      let next = -1;
      const list = segments ?? [];
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].start <= t) next = i;
        else break;
      }
      setActiveIndex(next);
    }
    video.addEventListener("timeupdate", syncActive);
    return () => video.removeEventListener("timeupdate", syncActive);
  }, [videoRef, segments, status]);

  useEffect(() => {
    if (query) return;
    const container = listRef.current;
    const line = activeRef.current;
    if (!container || !line) return;
    // Scroll the transcript box only — never scrollIntoView, which would also
    // scroll the page/window and yank the viewport away from the video.
    const box = container.getBoundingClientRect();
    const row = line.getBoundingClientRect();
    if (row.top < box.top) {
      container.scrollTop -= box.top - row.top;
    } else if (row.bottom > box.bottom) {
      container.scrollTop += row.bottom - box.bottom;
    }
  }, [activeIndex, query]);

  function transcribe() {
    startTranscription(async () => {
      await requestTranscription(slug);
      router.refresh();
    });
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play();
  }

  async function copyTranscript() {
    const text = (segments ?? []).map((s) => s.text).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (status === "none") {
    if (!isOwner) return null;
    return (
      <PanelShell>
        <EmptyPrompt
          icon={Sparkles}
          message="This recording hasn't been transcribed yet."
          actionLabel="Transcribe"
          busy={isStarting}
          onAction={transcribe}
        />
      </PanelShell>
    );
  }

  if (inProgress) {
    return (
      <PanelShell>
        <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Transcribing this recording…
        </div>
        <TranscriptSkeleton />
      </PanelShell>
    );
  }

  if (status === "error") {
    return (
      <PanelShell>
        {isOwner ? (
          <EmptyPrompt
            icon={RotateCw}
            message="Transcription failed for this recording."
            actionLabel="Retry"
            busy={isStarting}
            onAction={transcribe}
          />
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Transcript unavailable for this recording.
          </p>
        )}
      </PanelShell>
    );
  }

  if (indexed.length === 0) {
    return (
      <PanelShell>
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No speech was detected in this recording.
        </p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-base font-semibold">Transcript</h2>
        <button
          type="button"
          onClick={copyTranscript}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="px-1 pb-2">
        <div className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search transcript"
            aria-label="Search transcript"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query.trim() ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "match" : "matches"}
            </span>
          ) : null}
        </div>
      </div>

      <ul
        ref={listRef}
        className="max-h-96 space-y-0.5 overflow-y-auto py-1 lg:max-h-[calc(100svh-23rem)]"
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No matches for “{query.trim()}”.
          </li>
        ) : (
          filtered.map(({ segment, index }) => {
            const isActive = index === activeIndex;
            return (
              <li key={index}>
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => seekTo(segment.start)}
                  className={cn(
                    "flex w-full gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary",
                    isActive && "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 pt-0.5 text-xs tabular-nums",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {formatDuration(segment.start)}
                  </span>
                  <span className="text-sm leading-relaxed">{segment.text}</span>
                </button>
              </li>
            );
          })
        )}
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
}: {
  icon: typeof FileText;
  message: string;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="size-4" />
        {message}
      </p>
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
    </div>
  );
}

const SKELETON_ROWS = [
  "w-[78%]",
  "w-[92%]",
  "w-[64%]",
  "w-[85%]",
  "w-[71%]",
  "w-[88%]",
];

function TranscriptSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {SKELETON_ROWS.map((width, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="mt-0.5 h-3 w-8 shrink-0" />
          <Skeleton className={cn("h-3", width)} />
        </div>
      ))}
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}
