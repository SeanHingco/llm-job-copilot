// next.config.ts
import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;

if (!API_ORIGIN || !/^https?:\/\//.test(API_ORIGIN)) {
  throw new Error(`Invalid API_ORIGIN/NEXT_PUBLIC_API_URL for rewrites: "${API_ORIGIN ?? ""}"`);
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/r/:code",
        destination: `${API_ORIGIN}/r/:code`, // must be https://your-fastapi-host
      },
    ];
  },
};

export default nextConfig;
