'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { apiFetch } from '@/lib/api'

export default function DebugAuth() {
  const [email, setEmail] = useState<string | null>(null)
  const [whoami, setWhoami] = useState<string>('')
  const [me, setMe] = useState<{email?: string; plan?: string; free_uses_remaining?: number} | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/me")
      if (res.ok) setMe(await res.json())
    })()
  }, [])

  async function pingApi() {
    try {
      // const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await apiFetch('/whoami')
      const json = await res.json()
      setWhoami(JSON.stringify(json, null, 2))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setWhoami(`Error: ${msg || String(e)}`)
    }
  }

  async function bootstrap() {
    const res = await apiFetch('/bootstrap')
    console.log(await res.json())
  }

  async function checkMe() {
    const res = await apiFetch('/whoami')
    alert(JSON.stringify(await res.json(), null, 2))
  }

  async function spendOne() {
    const res = await apiFetch('/spend', { method: 'POST' })
    if (res.status === 402) {
      const body = await res.json()
      alert(`Need to upgrade: ${body.detail}`)
      return
    }
    alert(JSON.stringify(await res.json(), null, 2))
  }

  async function subscribeStarter() {
    const res = await apiFetch('/billing/checkout', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  async function manageBilling() {
    const res = await apiFetch('/billing/portal')
    if (!res.ok) {
      const msg = await res.text()
      alert(`Could not open billing portal: ${msg}`)
      return
    }
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sid = p.get('session_id')
    if (!sid) return
    ;(async () => {
      const res = await apiFetch('/billing/complete-subscription', {
        method: 'POST',
        body: JSON.stringify({ session_id: sid }),
      })
      const json = await res.json()
      alert(`Plan: ${json.plan}. Credited ${json.credited}.`)
      // clean the URL so it won't repeat on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    })()
  }, [])

  return (
    <main style={{ padding: 24 }}>
      <div style={{ marginBottom: 12, padding: 8, border: "1px solid #ddd", borderRadius: 8 }}>
        <div><b>Email:</b> {me?.email ?? "—"}</div>
        <div><b>Plan:</b> {me?.plan ?? "free"}</div>
        <div><b>Credits left:</b> {me?.free_uses_remaining ?? 0}</div>
      </div>
      <h1>Debug: Auth</h1>
      <p>Client user: <b>{email ?? 'Not signed in'}</b></p>
      <button onClick={pingApi} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
        Ping /whoami
      </button>
      <button onClick={bootstrap} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
        Ping /bootstrap
      </button>
      <button onClick={checkMe} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
        Ping /checkMe
      </button>
      <button onClick={spendOne} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
        Ping /spendOne
      </button>
      <button onClick={subscribeStarter} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
        Subscribe (Starter)
      </button>
      <button onClick={manageBilling} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8, marginLeft: 8 }}>
        Manage billing
      </button>
      {whoami && (
        <>
          <h2>API response</h2>
          <pre>{whoami}</pre>
        </>
      )}
    </main>
  )
}