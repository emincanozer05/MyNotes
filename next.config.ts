import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Notes/summaries can embed images as base64 data URLs, so a single
      // save easily exceeds the 1MB default and would fail silently.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
