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
      ...(process.env.MEDIA_SERVER_HOSTNAME
        ? [{ hostname: process.env.MEDIA_SERVER_HOSTNAME }]
        : []),
    ],
  },
};

export default nextConfig;
