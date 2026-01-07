'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function FinalizeReferral() {
  const once = useRef(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (once.current) return
    once.current = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      try {
        const res = await fetch('/api/referrals/finalize', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        const grants: Array<{ granted_type: string; granted_reason: string }> = json?.grants || []
        const gotPremium  = grants.some(g => g.granted_type === 'premium_month')
        const gotTemplate = grants.some(g => g.granted_type === 'template')
        if (gotPremium)      setMessage('🎉 Premium month unlocked!')
        else if (gotTemplate) setMessage('✅ Template unlocked!')
      } catch {
        // non-blocking; ignore errors
      }
    })()
  }, [])

  // auto-hide toast
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  // lightweight toast UI
  return message ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground shadow-[var(--shadow)]">
      {message}
    </div>
  ) : null
}
