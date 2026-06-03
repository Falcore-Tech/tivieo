"use client";

import { createContext, useContext, useRef, type RefObject } from "react";

const VideoRefContext = createContext<RefObject<HTMLVideoElement | null> | null>(
  null,
);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <VideoRefContext.Provider value={videoRef}>
      {children}
    </VideoRefContext.Provider>
  );
}

export function useVideoRef() {
  const ref = useContext(VideoRefContext);
  if (!ref) throw new Error("useVideoRef must be used within a VideoProvider");
  return ref;
}
