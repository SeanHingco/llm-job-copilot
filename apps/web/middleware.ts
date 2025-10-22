// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export const config = {
  matcher: ["/draft/:path*"], // only guard the Draft area for now
};

export function middleware(req: NextRequest) {
  // Supabase usually sets one of these when logged in. Adjust if your cookie names differ.
  const hasSession =
    req.cookies.has("sb-access-token") ||
    req.cookies.has("sb:token") ||
    req.cookies.has("sb-access-token.0");

  if (hasSession) return NextResponse.next(); // allow through

  // Not logged in → redirect BEFORE rendering /draft
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // preserve return path so we can bounce back after login
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
