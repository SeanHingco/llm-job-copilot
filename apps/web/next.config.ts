import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL;

if (!API_ORIGIN) {
  // Fail fast at build if env isn't present
  throw new Error('Missing API_ORIGIN/NEXT_PUBLIC_API_URL for rewrites.');
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/r/:code',
        destination: `${API_ORIGIN}/r/:code`,
      },
    ];
  },
};

export default nextConfig;
