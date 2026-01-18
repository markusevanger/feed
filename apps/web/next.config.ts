import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP: isDev,
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
