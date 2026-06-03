"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setThumbnail } from "../_actions";

type Props = {
  recordingId: string;
  videoUrl: string | null;
  initialThumbnailUrl: string | null;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function ThumbnailPicker({
  recordingId,
  videoUrl,
  initialThumbnailUrl,
}: Props) {
  const [preview, setPreview] = useState(initialThumbnailUrl);
  const [framing, setFraming] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function saveBlob(blob: Blob) {
    setBusy(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const result = await setThumbnail(recordingId, dataUrl);
      if (result.error) throw new Error(result.error);
      setPreview(`${result.url}?t=${Date.now()}`);
      toast.success("Thumbnail updated");
      setFraming(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update thumbnail.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await saveBlob(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Let the video load to a frame first.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) saveBlob(blob);
          else toast.error("The browser blocked capturing this frame.");
        },
        "image/jpeg",
        0.82,
      );
    } catch {
      toast.error("The browser blocked capturing this frame.");
    }
  }

  return (
    <div className="grid gap-3">
      <Label>Thumbnail</Label>
      <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-border bg-neutral-950">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-neutral-500">
            No thumbnail
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/50">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImageUp className="size-4" /> Upload image
        </Button>
        {videoUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setFraming((value) => !value)}
          >
            <Camera className="size-4" /> {framing ? "Hide frames" : "Pick a frame"}
          </Button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {framing && videoUrl ? (
        <div className="grid max-w-sm gap-2 rounded-lg border border-border p-3">
          <video
            ref={videoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            controls
            preload="metadata"
            className="aspect-video w-full rounded bg-neutral-950"
          />
          <p className="text-xs text-muted-foreground">
            Scrub to the frame you want, then capture it.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={captureFrame}
            className="w-fit"
          >
            <Camera className="size-4" /> Use this frame
          </Button>
        </div>
      ) : null}
    </div>
  );
}
