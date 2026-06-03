"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 1, 1.5, 2];

type Props = {
  src: string;
  title: string;
  poster?: string | null;
};

export function VideoPlayer({ src, title, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
        className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-neutral-950"
      >
        <source src={src} type="video/webm" />
        Your browser doesn&apos;t support embedded video.
      </video>

      <div className="flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Speed</span>
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => changeSpeed(value)}
            className={cn(
              "rounded px-2 py-0.5 text-xs tabular-nums transition-colors",
              speed === value
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value}×
          </button>
        ))}
      </div>
    </div>
  );
}
