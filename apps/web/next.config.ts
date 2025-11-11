import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = (params?.code ?? "").trim();
  if (!code) return NextResponse.redirect(new URL("/login", req.url));

  if (!API_ORIGIN || !/^https?:\/\//.test(API_ORIGIN)) {
    // Graceful fallback if env missing in this environment
    return NextResponse.redirect(new URL("/login?ref=misconfigured", req.url));
  }

  // Forward request to FastAPI and relay response (incl. Set-Cookie + Location)
  const upstream = await fetch(`${API_ORIGIN}/r/${encodeURIComponent(code)}`, {
    method: "GET",
    headers: {
      // Forward a few useful headers
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      "x-real-ip": req.headers.get("x-real-ip") ?? "",
      "user-agent": req.headers.get("user-agent") ?? "",
    },
    redirect: "manual", // don't follow; we need to forward the redirect to the client
  });

  const location = upstream.headers.get("location");
  const status = upstream.status;

  // Create a matching response (redirect or plain) and copy Set-Cookie so the cookie is set on your app’s domain
  const out = location
    ? NextResponse.redirect(location, status as 301 | 302 | 303 | 307 | 308)
    : new NextResponse(null, { status });

  // Forward cookies from FastAPI
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) out.headers.set("set-cookie", setCookie);

  return out;
}
