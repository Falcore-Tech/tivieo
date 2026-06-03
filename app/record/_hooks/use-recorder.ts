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
      console.log(
        "[recorder] start; mimeType:",
        mimeType || "(browser default)",
        "tracks:",
        stream.getTracks().map((t) => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
        })),
      );

      const videoTrack = stream.getVideoTracks()[0];
      console.log("[recorder] video track settings:", videoTrack?.getSettings());

      chunksRef.current = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
      } catch (error) {
        console.warn("[recorder] mimeType rejected, using default:", error);
        recorder = new MediaRecorder(stream);
      }
      recorder.ondataavailable = (event) => {
        console.log("[recorder] dataavailable; size:", event.data?.size ?? 0);
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = (event) =>
        console.error("[recorder] error:", (event as ErrorEvent).error ?? event);
      recorder.onstart = () =>
        console.log("[recorder] onstart; state:", recorder.state);

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
        console.log("[recorder] final blob size:", result?.size ?? 0);
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
