"use client";

import { useCallback, useRef, useState } from "react";

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return (
    candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

// Explicit bitrates so file size is predictable instead of browser-default.
// Recording is full 1080p (see OUTPUT_WIDTH/HEIGHT in use-canvas-compositor.ts)
// stored on Cloudflare R2, which has no per-file cap, so we use a quality-grade
// 8 Mbps video + 128 kbps audio ≈ 61 MB/min for crisp screen text and webcam.
// Tunable: lower it to trade quality for smaller files.
const VIDEO_BITS_PER_SECOND = 8_000_000;
const AUDIO_BITS_PER_SECOND = 128_000;

export function useRecorder() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const start = useCallback(
    async (stream: MediaStream) => {
      if (recorderRef.current) return;
      const mimeType = pickMimeType();
      chunksRef.current = [];
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, recorderOptions);
      } catch {
        recorder = new MediaRecorder(stream, {
          videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      }
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorderRef.current = recorder;
      setElapsedSeconds(0);
      // timeslice flushes a chunk every second so we never lose the take.
      recorder.start(1000);
      startTimer();
    },
    [startTimer],
  );

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
    }
    stopTimer();
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
    }
    startTimer();
  }, [startTimer]);

  const buildBlob = useCallback((recorder: MediaRecorder) => {
    if (chunksRef.current.length === 0) return null;
    return new Blob(chunksRef.current, {
      type: recorder.mimeType || "video/webm",
    });
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    stopTimer();

    const blob = await new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        const result = buildBlob(recorder);
        resolve(result);
      };
      recorder.onstop = finish;
      if (recorder.state !== "inactive") {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }
        recorder.stop();
      } else {
        finish();
      }
      // Safety net in case onstop never fires.
      setTimeout(finish, 5000);
    });

    recorderRef.current = null;
    chunksRef.current = [];
    return blob;
  }, [buildBlob, stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setElapsedSeconds(0);
  }, [stopTimer]);

  return { elapsedSeconds, start, pause, resume, stop, reset };
}
