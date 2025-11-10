'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  user_id: string
  code: string
  total_clicks: number
  converted_signups: number
  last_conversion_at: string | null
}

type ApiResponse = { rows?: Row[] }

export default function AdminReferralsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.replace('/'); return }
      try {
        const res = await fetch('/api/admin/referrals', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.status === 401 || res.status === 403) { router.replace('/'); return }

        const json: ApiResponse = await res.json()   // <- typed
        if (!cancelled) setRows(json.rows ?? [])
      } catch (e: unknown) {                         // <- no any
        const message = e instanceof Error ? e.message : 'Failed to load'
        if (!cancelled) setErr(message)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  if (err) return <main className="p-6">Error: {err}</main>
  if (!rows) return <main className="p-6">Loading…</main>

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Referrals — Admin</h1>
      <div className="overflow-auto rounded border">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">User ID</th>
              <th className="text-right p-2">Clicks</th>
              <th className="text-right p-2">Converted</th>
              <th className="text-left p-2">Last Conversion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t">
                <td className="p-2 font-mono">{r.code}</td>
                <td className="p-2 font-mono">{r.user_id}</td>
                <td className="p-2 text-right">{r.total_clicks}</td>
                <td className="p-2 text-right">{r.converted_signups}</td>
                <td className="p-2">{r.last_conversion_at ? new Date(r.last_conversion_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
