import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  env: {
    SANITY_STUDIO_MEDIA_SERVER_URL: process.env.SANITY_STUDIO_MEDIA_SERVER_URL,
    SANITY_STUDIO_MEDIA_API_KEY: process.env.SANITY_STUDIO_MEDIA_API_KEY,
  },
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
