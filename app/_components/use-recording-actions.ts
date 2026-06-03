"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { RecordingVisibility } from "@/lib/types";
import { copyWatchLink } from "./share-link";
import {
  deleteRecordingsForever,
  getDownloadUrl,
  restoreRecordings,
  setRecordingVisibility,
  softDeleteRecordings,
} from "../_actions";

export function useRecordingActions(id: string, slug: string) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await copyWatchLink(slug);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  }

  function changeVisibility(visibility: RecordingVisibility) {
    startTransition(async () => {
      const result = await setRecordingVisibility(id, visibility);
      if (result.error) toast.error(result.error);
      else toast.success(`Visibility set to ${visibility}`);
    });
  }

  function trash() {
    startTransition(async () => {
      const result = await softDeleteRecordings([id]);
      if (result.error) toast.error(result.error);
      else toast.success("Moved to trash");
    });
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreRecordings([id]);
      if (result.error) toast.error(result.error);
      else toast.success("Recording restored");
    });
  }

  function destroy() {
    startTransition(async () => {
      const result = await deleteRecordingsForever([id]);
      if (result.error) toast.error(result.error);
      else toast.success("Recording deleted permanently");
    });
  }

  async function download() {
    const result = await getDownloadUrl(id);
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not start the download.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return {
    copied,
    pending,
    copy,
    changeVisibility,
    trash,
    restore,
    destroy,
    download,
  };
}
