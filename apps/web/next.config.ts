// next.config.ts
import type { NextConfig } from 'next';

const isVercel = !!process.env.VERCEL;

// Prefer a server-only var; fall back to NEXT_PUBLIC_API_URL; then dev default.
const rawOrigin =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  (isVercel ? 'https://api.resumebender.com' : 'http://localhost:8000');

const API_ORIGIN = rawOrigin.replace(/\/+$/, ''); // strip trailing slash

// Log for verification in Vercel build output
// (Vercel redacts secrets in logs; this should still show the host)
console.log('[next.config] API_ORIGIN =', API_ORIGIN);

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
