"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ShareDialog } from "./share-dialog";

type Props = {
  slug: string;
  title: string;
};

export function WatchActions({ slug, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="inline-flex h-8 items-stretch overflow-hidden rounded-md bg-primary text-sm font-medium text-primary-foreground">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center px-3 transition-colors hover:bg-primary/85 focus-visible:bg-primary/85 focus-visible:outline-none"
        >
          Share
        </button>
        <span className="my-1.5 w-px bg-primary-foreground/25" aria-hidden />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link"
          className="inline-flex items-center px-2 transition-colors hover:bg-primary/85 focus-visible:bg-primary/85 focus-visible:outline-none"
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        </button>
      </div>

      <ShareDialog
        slug={slug}
        title={title}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
