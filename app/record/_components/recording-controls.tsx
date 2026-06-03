"use client";

import { Circle, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import type { RecorderPhase } from "../_types";

type Props = {
  phase: RecorderPhase;
  elapsedSeconds: number;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
};

export function RecordingControls({
  phase,
  elapsedSeconds,
  canStart,
  onStart,
  onStop,
  onPause,
  onResume,
}: Props) {
  const isRecording = phase === "recording";
  const isPaused = phase === "paused";

  return (
    <div className="flex items-center justify-center gap-3">
      {phase === "ready" && (
        <Button size="lg" onClick={onStart} disabled={!canStart}>
          <Circle className="size-4 fill-current" /> Start recording
        </Button>
      )}

      {(isRecording || isPaused) && (
        <>
          <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 font-mono text-sm tabular-nums">
            <span
              className={
                isRecording
                  ? "size-2.5 animate-pulse rounded-full bg-error-500"
                  : "size-2.5 rounded-full bg-warning-500"
              }
            />
            {formatDuration(elapsedSeconds)}
          </span>

          {isRecording ? (
            <Button variant="secondary" size="lg" onClick={onPause}>
              <Pause className="size-4" /> Pause
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={onResume}>
              <Play className="size-4" /> Resume
            </Button>
          )}

          <Button variant="destructive" size="lg" onClick={onStop}>
            <Square className="size-4 fill-current" /> Stop
          </Button>
        </>
      )}
    </div>
  );
}
