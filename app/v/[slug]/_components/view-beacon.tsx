"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { recordView } from "../_actions";

export function ViewBeacon({ slug }: { slug: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void recordView(slug);
    posthog.capture("recording_viewed", { slug });
  }, [slug]);

  return null;
}
