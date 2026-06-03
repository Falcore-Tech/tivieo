"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useVideoRef } from "./video-context";

const SPEEDS = [0.5, 1, 1.5, 2];

type Props = {
  src: string;
  title: string;
  poster?: string | null;
  captionsSrc?: string | null;
};

export function VideoPlayer({ src, title, poster, captionsSrc }: Props) {
  const videoRef = useVideoRef();
  const [speed, setSpeed] = useState(1);

  function changeSpeed(value: number) {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={title}
        className="aspect-video w-full overflow-hidden rounded-xl bg-video-surface ring-1 ring-border"
      >
        <source src={src} type="video/webm" />
        {captionsSrc ? (
          <track
            kind="captions"
            src={captionsSrc}
            srcLang="en"
            label="Captions"
            default
          />
        ) : null}
        Your browser doesn&apos;t support embedded video.
      </video>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed</span>
        <div
          role="group"
          aria-label="Playback speed"
          className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5"
        >
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => changeSpeed(value)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors",
                speed === value
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
