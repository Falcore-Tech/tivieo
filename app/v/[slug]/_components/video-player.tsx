"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";

type Props = {
  src: string;
  title: string;
  poster?: string | null;
};

export function VideoPlayer({ src, title, poster }: Props) {
  return (
    <MediaPlayer
      title={title}
      src={{ src, type: "video/webm" }}
      poster={poster ?? undefined}
      playsInline
      className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-neutral-950"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
