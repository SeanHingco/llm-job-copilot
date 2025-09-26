"use client";
import { ReactNode } from "react";

export default function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2
                   whitespace-pre rounded-md border bg-white px-2 py-1 text-xs text-neutral-800
                   shadow-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
                   transition-opacity"
      >
        {content}
      </span>
    </span>
  );
}