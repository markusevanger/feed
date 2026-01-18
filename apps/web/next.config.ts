import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'cdn.sanity.io',
      },
      {
        hostname: 'localhost',
      },
      {
        hostname: 'cdn.markusevanger.no',
      },
    ],
  },
};

export default nextConfig;
