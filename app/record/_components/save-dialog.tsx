"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import fixWebmDuration from "fix-webm-duration";
import { uploadRecording } from "../_lib/upload";
import { createRecording } from "../_actions";
import type { RecordingResult } from "../_types";

type Props = {
  open: boolean;
  result: RecordingResult | null;
  userId: string;
  onRecordAgain: () => void;
};

type Stage = "form" | "uploading" | "done";

export function SaveDialog({ open, result, userId, onRecordAgain }: Props) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [progress, setProgress] = useState(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const previewUrl = useMemo(
    () => (result ? URL.createObjectURL(result.blob) : null),
    [result],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const shareUrl =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/v/${slug}`
      : "";

  async function handleSave() {
    if (!result) return;
    setStage("uploading");
    setProgress(0);
    try {
      const playableBlob = await fixWebmDuration(
        result.blob,
        Math.round(result.durationSeconds * 1000),
        { logger: false },
      ).catch(() => result.blob);
      const upload = await uploadRecording({
        userId,
        blob: playableBlob,
        posterDataUrl: result.posterDataUrl,
        onProgress: setProgress,
      });
      const response = await createRecording({
        title,
        storagePath: upload.storagePath,
        thumbnailPath: upload.thumbnailPath,
        durationSeconds: Math.round(result.durationSeconds),
        sizeBytes: upload.sizeBytes,
      });
      if ("error" in response) {
        toast.error(response.error);
        setStage("form");
        return;
      }
      setSlug(response.slug);
      setStage("done");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Try again.",
      );
      setStage("form");
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {stage === "done" ? "Your recording is ready" : "Save your recording"}
          </DialogTitle>
          <DialogDescription>
            {stage === "done"
              ? "Share this link — anyone with it can watch."
              : "Give it a title to generate a shareable link."}
          </DialogDescription>
        </DialogHeader>

        {previewUrl && stage !== "done" && (
          <video
            src={previewUrl}
            controls
            className="aspect-video w-full rounded-lg border border-border bg-neutral-950"
          />
        )}

        {stage === "form" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                autoFocus
                placeholder="e.g. Product walkthrough"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onRecordAgain} className="flex-1">
                <RotateCcw className="size-4" /> Re-record
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Save & get link
              </Button>
            </div>
          </div>
        )}

        {stage === "uploading" && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Uploading… {Math.round(progress * 100)}%
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(4, progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-sm" />
              <Button
                variant="secondary"
                size="icon"
                onClick={handleCopy}
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="size-4 text-success-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onRecordAgain} className="flex-1">
                <RotateCcw className="size-4" /> Record another
              </Button>
              <Button asChild className="flex-1">
                <Link href={`/v/${slug}`}>
                  <ExternalLink className="size-4" /> Watch
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
