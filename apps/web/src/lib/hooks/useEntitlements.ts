// lib/hooks/useEntitlements.ts
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Ent = { kind: string; value: number | null; expires_at: string | null }

export function useEntitlements() {
  const [templateCredits, setTemplateCredits] = useState<number>(0)
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('entitlements')
        .select('kind,value,expires_at')
        .eq('user_id', user.id)

      if (error) return
      const rows = (data ?? []) as Ent[]

      const tc = rows.find(r => r.kind === 'template_credit')
      setTemplateCredits(Number(tc?.value ?? 0))

      const prem = rows
        .filter(r => r.kind === 'premium' && r.expires_at)
        .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())[0]
      setPremiumExpiresAt(prem?.expires_at ?? null)
    })()
  }, [])

  return { templateCredits, premiumExpiresAt }
}
