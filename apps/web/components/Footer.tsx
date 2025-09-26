"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>© {new Date().getFullYear()} Resume Bender</span>
        <nav className="flex items-center gap-4">
          <Link href="/legal/terms" className="hover:underline">Terms</Link>
          <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
          <a href="mailto:seanescan@gmail.com" className="hover:underline">Contact</a>
        </nav>
      </div>
    </footer>
  );
}