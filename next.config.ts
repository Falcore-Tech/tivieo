import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /api/remux worker spawns the ffmpeg-static native binary, which Next's
  // file tracing doesn't detect on its own — include it in that route's bundle.
  outputFileTracingIncludes: {
    "/api/remux": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
