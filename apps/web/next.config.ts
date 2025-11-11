/** @type {import('next').NextConfig} */
const API_ORIGIN =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL ? '' : 'http://localhost:8000'); // local dev fallback

if (!API_ORIGIN) {
  throw new Error('Missing API_ORIGIN/NEXT_PUBLIC_API_URL for rewrites.');
}

const CLEAN_ORIGIN = API_ORIGIN.replace(/\/+$/, ''); // remove trailing slash

console.log('[next.config] API_ORIGIN =', CLEAN_ORIGIN);

export default {
  async rewrites() {
    return [
      {
        source: '/r/:code',
        destination: `${CLEAN_ORIGIN}/r/:code`,
      },
    ];
  },
};