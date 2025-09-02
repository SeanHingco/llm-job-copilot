'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js';

export function useRequireAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true

    async function init() {
      // ✅ snapshot once, then subscribe
      const { data } = await supabase.auth.getSession();
      console.log('getSession user:', data.session?.user);
      if (!mounted) return
      const u = data.session?.user ?? null
      setUser(u)
      setReady(true)
      if (!u) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        router.replace(`/login?next=${next}`)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (!session?.user) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        router.replace(`/login?next=${next}`)
      }
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [router])

  return { ready, user }
}
