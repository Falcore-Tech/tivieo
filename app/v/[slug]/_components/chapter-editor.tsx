"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { Chapter } from "@/lib/types";
import { saveChapters } from "../_actions";
import { useVideoRef } from "./video-context";

type Row = { key: number; start: number; title: string; description: string };

let rowSeq = 0;
function makeRow(start: number, title: string, description = ""): Row {
  rowSeq += 1;
  return { key: rowSeq, start, title, description };
}

export function ChapterEditor({
  slug,
  chapters,
  onClose,
}: {
  slug: string;
  chapters: Chapter[];
  onClose: () => void;
}) {
  const videoRef = useVideoRef();
  const [rows, setRows] = useState<Row[]>(() =>
    chapters.length > 0
      ? chapters.map((c) => makeRow(c.start, c.title, c.description ?? ""))
      : [makeRow(0, "")],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, save] = useTransition();

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function addRow() {
    const start = Math.floor(videoRef.current?.currentTime ?? 0);
    setRows((prev) => [...prev, makeRow(start, "")]);
  }

  function commit() {
    setError(null);
    const payload: Chapter[] = rows
      .map((row) => {
        const description = row.description.trim();
        return {
          start: row.start,
          title: row.title.trim(),
          ...(description ? { description } : {}),
        };
      })
      .filter((chapter) => chapter.title.length > 0);
    save(async () => {
      const result = await saveChapters(slug, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-base font-semibold">Edit chapters</h2>
        <span className="text-xs text-muted-foreground">
          Set the start to the current playhead with the clock.
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-1.5 rounded-lg bg-secondary px-2 py-2"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateRow(row.key, {
                    start: Math.floor(videoRef.current?.currentTime ?? 0),
                  })
                }
                title="Set start to current time"
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Clock className="size-3.5" />
                {formatDuration(row.start)}
              </button>
              <input
                value={row.title}
                onChange={(event) =>
                  updateRow(row.key, { title: event.target.value })
                }
                placeholder="Chapter title"
                aria-label="Chapter title"
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                aria-label="Delete chapter"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <textarea
              value={row.description}
              onChange={(event) =>
                updateRow(row.key, { description: event.target.value })
              }
              placeholder="Description (optional)"
              aria-label="Chapter description"
              rows={2}
              className="w-full resize-none bg-transparent px-1.5 text-sm leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3.5" /> Add chapter
      </button>

      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 px-1 pt-1">
        <button
          type="button"
          onClick={commit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60",
          )}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
