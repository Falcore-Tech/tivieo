"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateTitle } from "../_actions";

type Props = {
  slug: string;
  value: string;
  canEdit: boolean;
};

export function EditableTitle({ slug, value, canEdit }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(value), [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const headingClass = "text-xl font-semibold tracking-tight text-balance";

  if (!canEdit) {
    return <h1 className={headingClass}>{title}</h1>;
  }

  function open() {
    setDraft(title);
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    const previous = title;
    setTitle(next);
    startTransition(async () => {
      const result = await updateTitle(slug, next);
      if (result.error) {
        setTitle(previous);
        toast.error(result.error);
      } else {
        toast.success("Title updated");
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        disabled={pending}
        aria-label="Recording title"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            setDraft(title);
            setEditing(false);
          }
        }}
        className={cn(
          headingClass,
          "-mx-1.5 w-full rounded-md bg-secondary px-1.5 py-0.5 outline-none ring-2 ring-ring/60",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Click to edit title"
      className={cn(
        headingClass,
        "group/title -mx-1.5 flex w-full items-start gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-secondary",
      )}
    >
      <span className="min-w-0">{title}</span>
      <Pencil className="mt-1.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" />
    </button>
  );
}
