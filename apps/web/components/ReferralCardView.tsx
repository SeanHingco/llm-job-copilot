'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ReferralCard from 'components/ReferralCard';
import { useEntitlements } from '@/lib/hooks/useEntitlements';

const GOAL = 3;

export default function ReferralCardView() {
  const [code, setCode] = useState<string>('');
  const [referredCount, setReferredCount] = useState<number>(0);

  // Optional: template credits & premium from your existing hook
  const { templateCredits = 0, premiumExpiresAt } = useEntitlements() ?? {};
  const premium = premiumExpiresAt
    ? { active: true, expires_at: premiumExpiresAt }
    : { active: false as const, expires_at: null as string | null };

  // Mint/fetch code + fetch progress on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1) Mint/fetch code
      const { data: codeRes, error: codeErr } = await supabase.rpc('create_or_get_referrer');
      if (!codeErr) {
        const c =
          (Array.isArray(codeRes) ? codeRes[0]?.code : (codeRes as { code?: string } | null)?.code) ?? '';
        if (!cancelled) setCode(c);
      }

      // 2) Fetch progress
      const { data: progRes, error: progErr } = await supabase.rpc('referral_progress');
      if (!progErr) {
        const v =
          (Array.isArray(progRes)
            ? (progRes[0]?.referrals_signed_up as number | undefined)
            : (progRes as { referrals_signed_up?: number } | null)?.referrals_signed_up) ?? 0;
        if (!cancelled) setReferredCount(v);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Build a RELATIVE path for display/click
  const referralPath = useMemo(() => (code ? `/r/${code}` : ''), [code]);

  // Build an ABSOLUTE URL for copy/share (client only)
  const referralUrl = useMemo(() => {
    if (!referralPath) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}${referralPath}` : referralPath;
  }, [referralPath]);

  // ---- Handlers (no `any`) ----
  const handleCopy = (): void => {
    if (!referralUrl) return;
    void navigator.clipboard.writeText(referralUrl);
  };

  const handleQuickShare = (): void => {
    if (!referralUrl) return;
    const shareUrl = `${referralUrl}?utm_source=referral&utm_medium=share&utm_campaign=rb_ref`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      navigator
        .share({
          title: 'Resume Bender — nail your resume fast',
          text: 'I’m using Resume Bender to tailor my resume to job descriptions.',
          url: shareUrl,
        })
        .catch(() => {
          // user cancelled – no-op
        });
    } else {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        '_blank'
      );
    }
  };

  const handleShareLinkedIn = (): void => {
    if (!referralUrl) return;
    const shareUrl = `${referralUrl}?utm_source=referral&utm_medium=share&utm_campaign=rb_ref`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      '_blank'
    );
  };

  const handleShareEmail = (): void => {
    if (!referralUrl) return;
    const shareUrl = `${referralUrl}?utm_source=referral&utm_medium=email&utm_campaign=rb_ref`;
    const subject = 'Try Resume Bender with my link';
    const body =
      `Hey — I’m using Resume Bender to fix my resume.\n\nJoin with my link: ${shareUrl}\n\n` +
      `It aligns your resume to the JD and gives fast bullet suggestions.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleShareSMS = (): void => {
    if (!referralUrl) return;
    const shareUrl = `${referralUrl}?utm_source=referral&utm_medium=sms&utm_campaign=rb_ref`;
    const body = `Try Resume Bender → ${shareUrl}`;
    window.location.href = `sms:&body=${encodeURIComponent(body)}`;
  };

  if (!code) return null;

  return (
    <ReferralCard
      referralUrl={referralUrl}      // or use `referralPath` if you prefer showing a relative URL
      referredCount={referredCount}
      goal={GOAL}
      premium={premium}
      templateCredits={templateCredits}
      onCopy={handleCopy}
      onQuickShare={handleQuickShare}
      onShareLinkedIn={handleShareLinkedIn}
      onShareEmail={handleShareEmail}
      onShareSMS={handleShareSMS}
      className=""
    />
  );
}
