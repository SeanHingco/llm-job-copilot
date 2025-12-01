// components/SidebarHeroCTA.tsx
"use client";

import { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { capture } from "@/lib/analytics";

export default function SidebarHeroCTA() {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // stop the instant full reload

    void (async () => {
      try {
        await capture("cta_click", {
          cta_id: "landing_sidebar_fix_resume",
          location: "landing_offer_box",
          destination: "/draft",
        });
      } catch (err) {
        // optional: console.error("Sidebar CTA capture error", err);
      } finally {
        // client-side navigation, like the purple button
        router.push("/draft");
      }
    })();
  };

  return (
    <a
      href="/draft"
      onClick={handleClick}
      className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-500"
    >
      Fix My Resume
    </a>
  );
}
