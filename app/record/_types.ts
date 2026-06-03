export type RecorderPhase =
  | "idle"
  | "ready"
  | "countdown"
  | "recording"
  | "paused"
  | "review";

export type BubbleCorner =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

export type RecordingResult = {
  blob: Blob;
  posterDataUrl: string | null;
  durationSeconds: number;
};
