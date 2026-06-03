"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { BubbleCorner } from "../_types";

type Options = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  corner: BubbleCorner;
  showBubble: boolean;
};

// Fixed output size. The canvas must NOT be resized after captureStream() is
// called — doing so ends the captured track on Firefox. drawCover() scales the
// screen/webcam to fit, so a constant 1080p surface works for any source size.
const OUTPUT_WIDTH = 1920;
const OUTPUT_HEIGHT = 1080;

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(dw / vw, dh / vh);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
}

function createHiddenVideo() {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  // Firefox doesn't reliably decode frames from a fully-detached <video>;
  // keep it in the DOM but visually hidden so drawImage gets real frames.
  video.style.position = "fixed";
  video.style.top = "-9999px";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);
  return video;
}

export function useCanvasCompositor({
  canvasRef,
  screenStream,
  webcamStream,
  corner,
  showBubble,
}: Options) {
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const renderRef = useRef<() => void>(() => {});

  useEffect(() => {
    screenVideoRef.current = createHiddenVideo();
    webcamVideoRef.current = createHiddenVideo();
    return () => {
      screenVideoRef.current?.pause();
      webcamVideoRef.current?.pause();
      screenVideoRef.current?.remove();
      webcamVideoRef.current?.remove();
      screenVideoRef.current = null;
      webcamVideoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = screenVideoRef.current;
    if (!video) return;
    video.srcObject = screenStream;
    if (screenStream) void video.play().catch(() => {});
  }, [screenStream]);

  useEffect(() => {
    const video = webcamVideoRef.current;
    if (!video) return;
    video.srcObject = webcamStream;
    if (webcamStream) void video.play().catch(() => {});
  }, [webcamStream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set the fixed size once; never resize after this (see note above).
    if (canvas.width !== OUTPUT_WIDTH) canvas.width = OUTPUT_WIDTH;
    if (canvas.height !== OUTPUT_HEIGHT) canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = OUTPUT_WIDTH;
    const height = OUTPUT_HEIGHT;

    const render = () => {
      const screenVideo = screenVideoRef.current;
      const webcamVideo = webcamVideoRef.current;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);

      if (screenStream && screenVideo) {
        drawCover(ctx, screenVideo, 0, 0, width, height);
      }

      if (showBubble && webcamStream && webcamVideo) {
        const size = Math.round(Math.min(width, height) * 0.26);
        const margin = Math.round(size * 0.18);
        const x =
          corner === "bottom-right" || corner === "top-right"
            ? width - size - margin
            : margin;
        const y =
          corner === "bottom-left" || corner === "bottom-right"
            ? height - size - margin
            : margin;
        const radius = size / 2;
        const cx = x + radius;
        const cy = y + radius;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // Mirror the webcam horizontally about the bubble center so it reads
        // like a natural mirror image (matches what users expect on camera).
        ctx.translate(cx * 2, 0);
        ctx.scale(-1, 1);
        drawCover(ctx, webcamVideo, x, y, size, size);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, size * 0.02);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
      }
    };

    renderRef.current = render;
    render();
  }, [canvasRef, screenStream, webcamStream, corner, showBubble]);

  // Drive painting. While the tab is visible, requestAnimationFrame gives
  // smooth, vsync-aligned frames. While the tab is hidden, the browser pauses
  // rAF AND clamps setInterval to ~1fps — which made backgrounded recordings
  // laggy. A Web Worker timer is NOT throttled for hidden tabs, so it pings the
  // main thread ~30fps to keep painting (and thus the capture) smooth.
  useEffect(() => {
    let active = true;
    let lastDraw = 0;
    const targetInterval = 1000 / 30;

    let rafId = requestAnimationFrame(function loop(now) {
      if (!document.hidden && now - lastDraw >= targetInterval - 1) {
        renderRef.current();
        lastDraw = now;
      }
      if (active) rafId = requestAnimationFrame(loop);
    });

    const workerSource = `let id=null;onmessage=(e)=>{if(e.data==='start'){if(id===null)id=setInterval(()=>postMessage(0),${Math.round(
      targetInterval,
    )});}else{clearInterval(id);id=null;}};`;
    const workerUrl = URL.createObjectURL(
      new Blob([workerSource], { type: "application/javascript" }),
    );
    const worker = new Worker(workerUrl);
    worker.onmessage = () => {
      if (document.hidden) renderRef.current();
    };
    worker.postMessage("start");

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      worker.postMessage("stop");
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  const getCompositeStream = useCallback(
    (fps = 30) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const stream = canvas.captureStream(fps);
      return stream;
    },
    [canvasRef],
  );

  const capturePoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/jpeg", 0.7);
  }, [canvasRef]);

  return { getCompositeStream, capturePoster };
}
