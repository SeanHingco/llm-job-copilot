// components/CTAButtons.tsx
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CTAButtons() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setAuthed(Boolean(data.session));
    })();
    return () => { cancelled = true; };
  }, []);

  function onPrimaryClick() {
    router.push(authed ? "/draft" : "/login");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onPrimaryClick}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Try it now
      </button>
      <a
        href="#how-it-works"
        className="inline-flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-800"
      >
        How it works
      </a>
    </div>
  );
}
