"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useMediaStreams } from "../_hooks/use-media-streams";
import { useCanvasCompositor } from "../_hooks/use-canvas-compositor";
import { useRecorder } from "../_hooks/use-recorder";
import { mixAudioTracks } from "../_lib/compose-audio";
import type { BubbleCorner, RecorderPhase, RecordingResult } from "../_types";
import { DevicePicker } from "./device-picker";
import { PipPreview } from "./pip-preview";
import { RecordingControls } from "./recording-controls";
import { SaveDialog } from "./save-dialog";

type StudioPhase = "setup" | "countdown" | "recording" | "paused" | "review";

export function RecorderStudio({ userId }: { userId: string }) {
  const media = useMediaStreams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCleanupRef = useRef<() => void>(() => {});

  const [corner, setCorner] = useState<BubbleCorner>("bottom-right");
  const [showBubble, setShowBubble] = useState(true);
  const [phase, setPhase] = useState<StudioPhase>("setup");
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const compositor = useCanvasCompositor({
    canvasRef,
    screenStream: media.screenStream,
    webcamStream: media.webcamStream,
    corner,
    showBubble,
  });
  const recorder = useRecorder();

  const hasScreen = Boolean(media.screenStream);
  const controlsPhase: RecorderPhase =
    phase === "setup" ? (hasScreen ? "ready" : "idle") : phase;

  const { enableCamera } = media;
  useEffect(() => {
    void enableCamera();
  }, [enableCamera]);

  const beginRecording = useCallback(async () => {
    const compositeStream = compositor.getCompositeStream(30);
    const videoTrack = compositeStream?.getVideoTracks()[0];
    if (!compositeStream || !videoTrack) return;

    const audioSources = [media.screenStream, media.webcamStream].filter(
      (stream): stream is MediaStream => stream !== null,
    );
    const mixed = mixAudioTracks(audioSources);
    audioCleanupRef.current = mixed.cleanup;
    if (mixed.track) compositeStream.addTrack(mixed.track);

    await recorder.start(compositeStream);
    setPhase("recording");
  }, [compositor, media.screenStream, media.webcamStream, recorder]);

  const handleStart = useCallback(() => {
    setPhase("countdown");
    let remaining = 3;
    setCountdown(remaining);
    const tick = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(tick);
        setCountdown(0);
        void beginRecording();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [beginRecording]);

  const handleStop = useCallback(async () => {
    const poster = compositor.capturePoster();
    const blob = await recorder.stop();
    audioCleanupRef.current();
    audioCleanupRef.current = () => {};
    if (!blob) {
      setPhase("setup");
      return;
    }
    setResult({
      blob,
      posterDataUrl: poster,
      durationSeconds: recorder.elapsedSeconds,
    });
    setPhase("review");
  }, [compositor, recorder]);

  const handleRecordAgain = useCallback(() => {
    setResult(null);
    recorder.reset();
    setPhase("setup");
  }, [recorder]);

  return (
    <div className="flex flex-col gap-6">
      {media.error && (
        <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          <AlertCircle className="size-4 shrink-0" />
          {media.error}
        </div>
      )}

      <div className="relative">
        <PipPreview
          canvasRef={canvasRef}
          hasScreen={hasScreen}
          corner={corner}
          showBubble={showBubble}
          onCornerChange={setCorner}
          onToggleBubble={() => setShowBubble((value) => !value)}
          onShareScreen={() => void media.enableScreen()}
        />

        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-neutral-950/70">
            <span className="text-7xl font-bold tabular-nums text-white">
              {countdown}
            </span>
          </div>
        )}
      </div>

      <DevicePicker
        cameras={media.cameras}
        microphones={media.microphones}
        selectedCameraId={media.selectedCameraId}
        selectedMicId={media.selectedMicId}
        disabled={phase === "recording" || phase === "paused"}
        onSelectCamera={(cameraId) =>
          void media.enableCamera(cameraId, media.selectedMicId || undefined)
        }
        onSelectMic={(micId) =>
          void media.enableCamera(media.selectedCameraId || undefined, micId)
        }
      />

      <RecordingControls
        phase={controlsPhase}
        elapsedSeconds={recorder.elapsedSeconds}
        canStart={hasScreen}
        onStart={handleStart}
        onStop={handleStop}
        onPause={() => {
          recorder.pause();
          setPhase("paused");
        }}
        onResume={() => {
          recorder.resume();
          setPhase("recording");
        }}
      />

      <SaveDialog
        open={phase === "review"}
        result={result}
        userId={userId}
        onRecordAgain={handleRecordAgain}
      />
    </div>
  );
}
