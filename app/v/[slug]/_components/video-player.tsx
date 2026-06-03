"use client";

type Props = {
  src: string;
  title: string;
  poster?: string | null;
};

export function VideoPlayer({ src, title, poster }: Props) {
  return (
    <video
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
  );
}
