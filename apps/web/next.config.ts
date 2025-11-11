// next.config.ts
import type { NextConfig } from 'next';

const API_ORIGIN =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL ? '' : 'http://localhost:8000');

if (!API_ORIGIN) {
  throw new Error('Missing API_ORIGIN/NEXT_PUBLIC_API_URL for rewrites.');
}

const CLEAN_ORIGIN = API_ORIGIN.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/r/:code',
        destination: `${CLEAN_ORIGIN}/r/:code`,
      },
    ];
  },
};

export default nextConfig;
