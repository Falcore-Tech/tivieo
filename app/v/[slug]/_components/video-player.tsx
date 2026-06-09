"use client";

import { useEffect, useRef, useState } from "react";
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import type { Chapter } from "@/lib/types";
import { useVideoRef } from "./video-context";

const SPEEDS = [0.5, 1, 1.5, 2];

type Props = {
  src: string;
  title: string;
  poster?: string | null;
  captionsSrc?: string | null;
  durationSeconds?: number | null;
  chapters?: Chapter[] | null;
};

function chapterAt(chapters: Chapter[], time: number) {
  let index = -1;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i].start <= time) index = i;
    else break;
  }
  return index;
}

function SeekBar({
  currentTime,
  duration,
  chapters,
  onSeek,
  onHoverChange,
}: {
  currentTime: number;
  duration: number;
  chapters: Chapter[];
  onSeek: (seconds: number) => void;
  onHoverChange?: (seconds: number | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  const hasDuration = duration > 0 && Number.isFinite(duration);
  const value = dragging ? dragValue : currentTime;
  const fraction = hasDuration ? Math.min(1, Math.max(0, value / duration)) : 0;

  const hoverChapter =
    hoverFraction !== null && chapters.length > 0
      ? chapters[chapterAt(chapters, hoverFraction * duration)]
      : null;

  function timeFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track || !hasDuration) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function fractionFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration) || 0}
      aria-valuenow={Math.floor(value) || 0}
      tabIndex={0}
      onPointerDown={(event) => {
        if (!hasDuration) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        setDragging(true);
        setDragValue(timeFromPointer(event.clientX));
      }}
      onPointerMove={(event) => {
        if (hasDuration) {
          setHoverFraction(fractionFromPointer(event.clientX));
          onHoverChange?.(timeFromPointer(event.clientX));
        }
        if (!draggingRef.current) return;
        setDragValue(timeFromPointer(event.clientX));
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onSeek(timeFromPointer(event.clientX));
        setDragging(false);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        setDragging(false);
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setHoverFraction(null);
        onHoverChange?.(null);
      }}
      onKeyDown={(event) => {
        if (!hasDuration) return;
        if (event.key === "ArrowLeft")
          onSeek(Math.max(0, currentTime - 5));
        else if (event.key === "ArrowRight")
          onSeek(Math.min(duration, currentTime + 5));
      }}
      className={cn(
        "group/seek relative flex h-3 w-full touch-none select-none items-center",
        hasDuration ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="relative h-1 w-full rounded-full bg-white/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${fraction * 100}%` }}
        />
        {hasDuration &&
          chapters.map((chapter, index) =>
            index === 0 ? null : (
              <span
                key={`${chapter.start}-${index}`}
                className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-video-surface/80"
                style={{ left: `${(chapter.start / duration) * 100}%` }}
              />
            ),
          )}
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-opacity",
            dragging || hovering ? "opacity-100" : "opacity-0",
          )}
          style={{ left: `${fraction * 100}%` }}
        />
      </div>

      {hovering && hoverFraction !== null && hoverChapter ? (
        <div
          className="pointer-events-none absolute bottom-4 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg ring-1 ring-white/10"
          style={{
            left: `${hoverFraction * 100}%`,
          }}
        >
          <span className="tabular-nums text-white/60">
            {formatDuration(hoverChapter.start)}
          </span>{" "}
          {hoverChapter.title}
        </div>
      ) : null}
    </div>
  );
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  title,
  poster,
  captionsSrc,
  durationSeconds,
  chapters,
}: Props) {
  const videoRef = useVideoRef();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const durationFixedRef = useRef(false);
  const chapterIndexRef = useRef(-1);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chapterList = chapters ?? [];
  const fallbackDuration =
    durationSeconds && durationSeconds > 0 ? durationSeconds : 0;

  const [overlayChapter, setOverlayChapter] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(Boolean(captionsSrc));
  const [activeCue, setActiveCue] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      // Ignore the time spike caused by the Infinity-duration probe below.
      if (!durationFixedRef.current) return;
      setCurrentTime(video.currentTime);
    };
    const onDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        durationFixedRef.current = true;
        setDuration(video.duration);
      } else if (fallbackDuration > 0) {
        setDuration(fallbackDuration);
      }
    };
    // MediaRecorder webm often reports duration = Infinity and is not seekable
    // until the browser has scanned to the end. Seeking to a huge time forces
    // that scan; the browser then clamps currentTime to the real end, exposes a
    // correct seekable range, and fires durationchange with the true duration.
    const onLoadedMetadata = () => {
      onDuration();
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        durationFixedRef.current = false;
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          durationFixedRef.current = true;
          video.currentTime = 0;
          setCurrentTime(0);
          if (video.seekable.length > 0) {
            setDuration(video.seekable.end(video.seekable.length - 1));
          }
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = 1e7;
      } else {
        durationFixedRef.current = true;
      }
    };
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("volumechange", onVolume);

    if (video.readyState >= 1) onLoadedMetadata();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("volumechange", onVolume);
    };
  }, [videoRef, fallbackDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = video.textTracks[0];
    if (!track) return;
    track.mode = "hidden";

    const onCueChange = () => {
      const cue = track.activeCues?.[0] as VTTCue | undefined;
      setActiveCue(cue?.text ?? "");
    };
    track.addEventListener("cuechange", onCueChange);
    return () => track.removeEventListener("cuechange", onCueChange);
  }, [videoRef, captionsSrc]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Briefly surface the chapter title when the active chapter changes.
  useEffect(() => {
    if (chapterList.length === 0) return;
    const index = chapterAt(chapterList, currentTime);
    if (index < 0 || index === chapterIndexRef.current) return;
    chapterIndexRef.current = index;
    setOverlayChapter(chapterList[index].title);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlayChapter(null), 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, currentTime]);

  useEffect(
    () => () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    },
    [],
  );

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  function changeSpeed(value: number) {
    setSpeed(value);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = value;
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapperRef.current?.requestFullscreen();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapperRef}
        className="group/player relative aspect-video overflow-hidden rounded-xl bg-video-surface ring-1 ring-border"
      >
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          aria-label={title}
          onClick={togglePlay}
          className="h-full w-full bg-video-surface object-contain"
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

        {overlayChapter ? (
          <div className="pointer-events-none absolute left-4 top-4 max-w-[70%] rounded-md bg-black/65 px-3 py-1.5 text-sm font-medium text-white opacity-100 backdrop-blur transition-opacity">
            {overlayChapter}
          </div>
        ) : null}

        {captionsOn && activeCue ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-4">
            <span className="max-w-[85%] rounded-md bg-black/70 px-4 py-2 text-center text-xl font-medium leading-snug text-white sm:text-2xl lg:text-3xl">
              {activeCue}
            </span>
          </div>
        ) : null}

        {!playing ? (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform hover:scale-105">
              <Play className="size-7 translate-x-0.5 fill-current" />
            </span>
          </button>
        ) : null}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-8 transition-opacity",
            playing
              ? "opacity-0 group-hover/player:opacity-100 focus-within:opacity-100"
              : "opacity-100",
          )}
        >
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            chapters={chapterList}
            onSeek={seek}
            onHoverChange={setHoverTime}
          />

          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            >
              {playing ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current" />
              )}
            </button>

            <span className="text-xs tabular-nums text-white/90">
              {formatClock(hoverTime ?? currentTime)} / {formatClock(duration)}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSpeedOpen((v) => !v)}
                  aria-label="Playback speed"
                  className="flex h-8 items-center rounded-md px-2 text-xs font-medium tabular-nums hover:bg-white/15"
                >
                  {speed.toFixed(1)}×
                </button>
                {speedOpen ? (
                  <div className="absolute bottom-10 right-0 flex flex-col overflow-hidden rounded-lg bg-neutral-900 py-1 text-sm text-white shadow-lg ring-1 ring-white/10">
                    {SPEEDS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => changeSpeed(value)}
                        className={cn(
                          "px-4 py-1 text-left tabular-nums hover:bg-white/10",
                          speed === value && "font-semibold text-white",
                        )}
                      >
                        {value.toFixed(1)}×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {captionsSrc ? (
                <button
                  type="button"
                  onClick={() => setCaptionsOn((v) => !v)}
                  aria-pressed={captionsOn}
                  aria-label="Toggle captions"
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md hover:bg-white/15",
                    captionsOn && "bg-white/20",
                  )}
                >
                  <Captions className="size-5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
              >
                {fullscreen ? (
                  <Minimize className="size-5" />
                ) : (
                  <Maximize className="size-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
