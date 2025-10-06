// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";
import Link from "next/link"

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Tiny header just for the login page */}
      <header className="sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-700 hover:text-white"
          >
            <span aria-hidden>←</span>
            Back to home
          </Link>
        </div>
      </header>

      <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
        {/* Give the form breathing room below the header */}
        <div className="mx-auto max-w-md px-6 pt-6 pb-16">
          <LoginClient />
        </div>
      </Suspense>
    </main>
  );
}
