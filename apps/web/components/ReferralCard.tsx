'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useEntitlements } from '@/lib/hooks/useEntitlements'
import ReferralCardView, { type Premium } from './ReferralCardView'

const GOAL = 3

export default function ReferralCard() {
  const [code, setCode] = useState<string>('')
  const [count, setCount] = useState<number>(0)

  // your existing hook
  const { templateCredits, premiumExpiresAt } = useEntitlements()

  // derive premium shape for the view
  const premium: Premium = useMemo(() => {
    if (!premiumExpiresAt) return { active: false, expires_at: null, days_left: null }
    const exp = new Date(premiumExpiresAt)
    const active = exp.getTime() > Date.now()
    const days_left = Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    return { active, expires_at: exp.toISOString(), days_left }
  }, [premiumExpiresAt])

  // fetch code + progress (matches your original RPCs)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // 1) mint/fetch referrer code
      const { data: codeRes, error: codeErr } = await supabase.rpc('create_or_get_referrer')
      if (!codeErr) {
        const c = (Array.isArray(codeRes) ? codeRes[0]?.code : (codeRes as any)?.code) ?? ''
        if (!cancelled) setCode(c || '')
      }

      // 2) referral progress
      const { data: progRes, error: progErr } = await supabase.rpc('referral_progress')
      if (!progErr) {
        const v =
          (Array.isArray(progRes)
            ? (progRes[0]?.referrals_signed_up ?? 0)
            : (progRes as any)?.referrals_signed_up ?? 0)
        if (!cancelled) setCount(Number(v) || 0)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // build URL (origin-aware)
  const siteUrl =
    (typeof window !== 'undefined' && window.location?.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  const referralUrl = code ? `${siteUrl}/r/${code}` : ''

  // share helpers
  const shareUrl = referralUrl
    ? `${referralUrl}?utm_source=referral&utm_medium=share&utm_campaign=rb_ref`
    : ''
  const shareTitle = 'Resume Bender — nail your resume fast'
  const shareText  = `I’m using Resume Bender to tailor my resume to job descriptions. Try it with my link: ${shareUrl}`

  const onQuickShare = async () => {
    if (!shareUrl) return
    if (navigator.share) {
      try { await navigator.share({ title: shareTitle, text: shareText, url: shareUrl }) } catch {}
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')
    }
  }
  const onShareLinkedIn = () => {
    if (!shareUrl) return
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')
  }
  const onShareEmail = () => {
    if (!shareUrl) return
    const subject = 'Try Resume Bender with my link'
    const body = `Hey — I’m using Resume Bender to fix my resume.\n\nJoin with my link: ${shareUrl}\n\nIt aligns your resume to the JD and gives fast bullet suggestions.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  const onShareSMS = () => {
    if (!shareUrl) return
    const body = `Try Resume Bender → ${shareUrl}`
    window.location.href = `sms:&body=${encodeURIComponent(body)}`
  }
  const onCopy = async () => {
    if (!referralUrl) return
    try { await navigator.clipboard.writeText(referralUrl) } catch {}
  }

  // keep layout stable while loading the code
  if (!code) {
    return (
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        <div className="mt-4 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
        <div className="mt-4 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
      </section>
    )
  }

  return (
    <ReferralCardView
      referralUrl={referralUrl}
      referredCount={count}
      goal={GOAL}
      premium={premium}
      templateCredits={templateCredits || 0}
      onCopy={onCopy}
      onQuickShare={onQuickShare}
      onShareLinkedIn={onShareLinkedIn}
      onShareEmail={onShareEmail}
      onShareSMS={onShareSMS}
    />
  )
}
