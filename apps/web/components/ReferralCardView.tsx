'use client'
import { useMemo } from 'react'

export type Premium = { active: boolean; expires_at?: string | null; days_left?: number | null }

type Props = {
  referralUrl: string
  referredCount: number
  goal: number
  premium: Premium
  templateCredits: number
  onCopy: () => void
  onQuickShare: () => void
  onShareLinkedIn: () => void
  onShareEmail: () => void
  onShareSMS: () => void
  className?: string
}

export default function ReferralCardView({
  referralUrl,
  referredCount,
  goal,
  premium,
  templateCredits,
  onCopy,
  onQuickShare,
  onShareLinkedIn,
  onShareEmail,
  onShareSMS,
  className,
}: Props) {
  const pct = useMemo(
    () => Math.min(100, Math.round((referredCount / Math.max(1, goal)) * 100)),
    [referredCount, goal]
  )

  return (
    <section
      className={[
        'rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-sm',
        'max-w-[860px] w-full',
        className || '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Invite friends, earn Premium
        </h3>
        <span className="text-xs sm:text-sm rounded-full border px-2.5 py-1 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700">
          {referredCount}/{goal}
        </span>
      </div>

      {/* link + copy */}
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm sm:text-base text-neutral-900 dark:text-neutral-100"
          value={referralUrl}
          readOnly
        />
        <button
          onClick={onCopy}
          className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
        >
          Copy
        </button>
      </div>

      {/* progress */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'var(--ring, #4f7cff)' }}
          />
        </div>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {Math.max(0, goal - referredCount)} more = 1-month Premium 🚀
        </p>
      </div>

      {/* stats duo */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Template credits</div>
          <div className="mt-1 text-2xl font-semibold">{templateCredits}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Premium</div>
          <div className="mt-1 text-base">
            {premium.active
              ? (
                <>
                  <span className="font-semibold">Active</span>
                  {premium.expires_at
                    ? <> until {new Date(premium.expires_at).toLocaleDateString()}</>
                    : null}
                </>
              )
              : <span className="opacity-70">Locked — invite {Math.max(0, goal - referredCount)} more</span>}
          </div>
        </div>
      </div>

      {/* share buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
                onClick={onQuickShare}>Quick Share</button>
        <button className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
                onClick={onShareLinkedIn}>LinkedIn</button>
        <button className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
                onClick={onShareEmail}>Email</button>
        <button className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm"
                onClick={onShareSMS}>SMS</button>
      </div>
    </section>
  )
}
