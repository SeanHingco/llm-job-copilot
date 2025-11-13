// app/r/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = (params?.code ?? "").trim();
  if (!code) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!API_ORIGIN || !/^https?:\/\//.test(API_ORIGIN)) {
    // Env misconfigured → fail soft to login
    return NextResponse.redirect(new URL("/login?ref=misconfigured", req.url));
  }

  // Call FastAPI backend /r/{code}
  const upstream = await fetch(`${API_ORIGIN}/r/${encodeURIComponent(code)}`, {
    method: "GET",
    redirect: "manual", // don't auto-follow redirects, we want to propagate them
    headers: {
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      "user-agent": req.headers.get("user-agent") ?? "",
    },
  });

  const location = upstream.headers.get("location");
  const status = upstream.status;

  // Build the response: either a redirect, or a plain status
  const res = location
    ? NextResponse.redirect(location, status as 301 | 302 | 303 | 307 | 308)
    : new NextResponse(null, { status });

  // Forward Set-Cookie from FastAPI so rb_ref is set on the frontend domain
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    res.headers.set("set-cookie", setCookie);
  }

  return res;
}
