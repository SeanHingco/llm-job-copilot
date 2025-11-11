// components/ReferralCardView.tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ReferralCard from 'components/ReferralCard'

type ProgressRow =
  | { referrals_signed_up: number }
  | null

type CodeRow =
  | { code: string }
  | null

type Premium = { active: boolean; expires_at?: string | null }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const GOAL = 3

export default function ReferralCardView() {
  const [code, setCode] = useState<string>('')
  const [count, setCount] = useState<number>(0)
  const [premium, setPremium] = useState<Premium>({ active: false, expires_at: null })
  const [templateCredits, setTemplateCredits] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Mint/fetch referral code
      const { data: codeRes, error: codeErr } = await supabase.rpc('create_or_get_referrer')
      if (!codeErr) {
        const c = (Array.isArray(codeRes) ? (codeRes as CodeRow[])[0]?.code : (codeRes as CodeRow)?.code) ?? ''
        if (!cancelled) setCode(c)
      }

      // Progress
      const { data: progRes, error: progErr } = await supabase.rpc('referral_progress')
      if (!progErr) {
        const v = (Array.isArray(progRes)
          ? (progRes as ProgressRow[])[0]?.referrals_signed_up
          : (progRes as ProgressRow)?.referrals_signed_up) ?? 0
        if (!cancelled) setCount(v)
      }

      // Entitlements (template credits + premium)
      const { data: entRes, error: entErr } = await supabase
        .from('entitlements')
        .select('kind,value,expires_at')
        .eq('user_id', user.id)

      if (!entErr && Array.isArray(entRes)) {
        const tmpl = entRes.find(r => r.kind === 'template_credits')
        const prem = entRes.find(r => r.kind === 'premium')
        if (!cancelled) {
          setTemplateCredits(Number(tmpl?.value ?? 0))
          const expires = prem?.expires_at ?? null
          setPremium({
            active: Boolean(expires && new Date(expires) > new Date()),
            expires_at: expires ?? null,
          })
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const referralUrl = useMemo(
    () => (code ? `${SITE_URL}/r/${code}` : ''),
    [code]
  )

  // Button handlers (typed)
  const handleCopy = useCallback(() => {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl).catch(() => {})
  }, [referralUrl])

  const shareUrl = useMemo(
    () => (referralUrl ? `${referralUrl}?utm_source=referral&utm_medium=share&utm_campaign=rb_ref` : ''),
    [referralUrl]
  )

  const handleQuickShare = useCallback(async () => {
    if (!shareUrl) return
    const title = 'Resume Bender — nail your resume fast'
    const text  = `I’m using Resume Bender to tailor my resume to job descriptions. Try it: ${shareUrl}`
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }) } catch { /* cancel */ }
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')
    }
  }, [shareUrl])

  const handleShareLinkedIn = useCallback(() => {
    if (!shareUrl) return
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')
  }, [shareUrl])

  const handleShareEmail = useCallback(() => {
    if (!shareUrl) return
    const subject = 'Try Resume Bender with my link'
    const body = `Hey — I’m using Resume Bender to fix my resume.\n\nJoin with my link: ${shareUrl}\n\nIt aligns your resume to the JD and gives fast bullet suggestions.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [shareUrl])

  const handleShareSMS = useCallback(() => {
    if (!shareUrl) return
    const body = `Try Resume Bender → ${shareUrl}`
    window.location.href = `sms:&body=${encodeURIComponent(body)}`
  }, [shareUrl])

  if (!code) return null

  return (
    <ReferralCard
      referralUrl={referralUrl}
      referredCount={count}
      goal={GOAL}
      premium={premium}
      templateCredits={templateCredits}
      onCopy={handleCopy}
      onQuickShare={handleQuickShare}
      onShareLinkedIn={handleShareLinkedIn}
      onShareEmail={handleShareEmail}
      onShareSMS={handleShareSMS}
      className="bg-gradient-to-br from-indigo-600/20 to-sky-500/10"
    />
  )
}
