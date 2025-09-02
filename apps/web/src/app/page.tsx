'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RootRedirect() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) router.replace('/draft');
      else router.replace('/login');
      setBooting(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Tiny fallback to prevent a flash
  return (
    <div className="min-h-[50vh] grid place-items-center text-sm text-slate-600">
      {booting ? 'Redirecting…' : null}
    </div>
  );
}
