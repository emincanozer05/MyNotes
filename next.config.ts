import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client router cache: revisiting a section within 30s reuses the cached
    // RSC payload instead of a full server round-trip, so switching between
    // tabs feels instant. Server actions call revalidatePath() after every
    // mutation, which purges this cache — edits never show stale data.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      // Notes/summaries can embed images as base64 data URLs, so a single
      // save easily exceeds the 1MB default and would fail silently.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
