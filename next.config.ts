import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /api/remux worker spawns the ffmpeg-static native binary, which Next's
  // file tracing doesn't detect on its own — include it in that route's bundle.
  outputFileTracingIncludes: {
    "/api/remux": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
