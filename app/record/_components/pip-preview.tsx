"use client";

import { type RefObject } from "react";
import { MonitorUp, UserRound, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BubbleCorner } from "../_types";

const CORNERS: { value: BubbleCorner; label: string; className: string }[] = [
  { value: "top-left", label: "Top left", className: "top-2 left-2" },
  { value: "top-right", label: "Top right", className: "top-2 right-2" },
  { value: "bottom-left", label: "Bottom left", className: "bottom-2 left-2" },
  { value: "bottom-right", label: "Bottom right", className: "bottom-2 right-2" },
];

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hasScreen: boolean;
  corner: BubbleCorner;
  showBubble: boolean;
  onCornerChange: (corner: BubbleCorner) => void;
  onToggleBubble: () => void;
  onShareScreen: () => void;
};

export function PipPreview({
  canvasRef,
  hasScreen,
  corner,
  showBubble,
  onCornerChange,
  onToggleBubble,
  onShareScreen,
}: Props) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-neutral-950">
      <canvas
        ref={canvasRef}
        className={cn("size-full object-contain", !hasScreen && "opacity-40")}
      />

      {!hasScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-xs text-sm text-neutral-300">
            Share a screen, window, or tab to start. Your camera appears as a
            bubble on top.
          </p>
          <Button onClick={onShareScreen}>
            <MonitorUp className="size-4" /> Share your screen
          </Button>
        </div>
      )}

      {hasScreen && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-neutral-950/80 to-transparent p-3">
          <div className="flex items-center gap-1.5">
            {CORNERS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => onCornerChange(option.value)}
                className={cn(
                  "size-7 rounded-md border transition-colors",
                  corner === option.value
                    ? "border-primary bg-primary/20"
                    : "border-white/30 bg-white/10 hover:bg-white/20",
                )}
              >
                <span
                  className={cn(
                    "relative block size-full",
                    "after:absolute after:size-2 after:rounded-full after:bg-white",
                    option.value === "top-left" && "after:left-1 after:top-1",
                    option.value === "top-right" && "after:right-1 after:top-1",
                    option.value === "bottom-left" && "after:bottom-1 after:left-1",
                    option.value === "bottom-right" &&
                      "after:bottom-1 after:right-1",
                  )}
                />
              </button>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onToggleBubble}
          >
            {showBubble ? (
              <>
                <UserRoundX className="size-4" /> Hide camera
              </>
            ) : (
              <>
                <UserRound className="size-4" /> Show camera
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
