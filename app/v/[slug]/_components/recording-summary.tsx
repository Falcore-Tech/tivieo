"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateSummary } from "../_actions";

type Props = {
  slug: string;
  summary: string | null;
  canEdit: boolean;
};

const LONG_SUMMARY = 240;

export function RecordingSummary({ slug, summary, canEdit }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(summary ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(summary ?? ""), [summary]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function open() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateSummary(slug, next);
      if (result.error) {
        setValue(previous);
        toast.error(result.error);
      } else {
        toast.success("Description updated");
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          rows={5}
          disabled={pending}
          aria-label="Recording description"
          placeholder="Write a short description…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
            } else if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              commit();
            }
          }}
          className="w-full resize-y rounded-lg bg-secondary px-3 py-2 text-sm leading-relaxed outline-none ring-2 ring-ring/60 placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={commit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            ⌘↵ to save
          </span>
        </div>
      </div>
    );
  }

  if (!value) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add a description
      </button>
    );
  }

  const isLong = value.length > LONG_SUMMARY;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <p
          onClick={canEdit ? open : undefined}
          className={cn(
            "text-sm leading-relaxed text-muted-foreground",
            !expanded && isLong && "line-clamp-4",
            canEdit &&
              "cursor-text rounded-md transition-colors hover:text-foreground",
          )}
          title={canEdit ? "Click to edit description" : undefined}
        >
          {value}
        </p>
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="self-start text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
