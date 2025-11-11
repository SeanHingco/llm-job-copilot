import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/r/:code',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/r/:code`, // e.g. https://api.resumebender.com
      },
    ]
  },
};

export default nextConfig;
