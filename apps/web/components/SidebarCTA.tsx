// components/SidebarHeroCTA.tsx
"use client";

import { capture } from "@/lib/analytics";

export default function SidebarCTA() {
  const handleClick = () => {
    void capture("cta_click", {
      cta_id: "landing_sidebar_fix_resume",
      location: "landing_offer_box",
      destination: "/login",
    });
  };

  return (
    <a
      href="/login"
      onClick={handleClick}
      className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-500"
    >
      Fix My Resume Now For Free
    </a>
  );
}
