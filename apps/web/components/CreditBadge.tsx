import React from 'react'

const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE === 'true'

type CreditProps = {
  value?: number
  loading?: boolean
  unlimited?: boolean
}

export default function CreditBadge({ value, loading, unlimited=false }: CreditProps) {
  if (FREE_MODE) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm whitespace-nowrap"
        aria-live="polite"
      >
        <span className="font-medium">Free during launch</span>
      </div>
    )
  }
  const display = unlimited
    ? '∞'
    : (typeof value === 'number' ? value : '—')

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
      aria-live="polite"
    >
      <span className="font-medium">Credits:</span>

      {loading ? (
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          updating…
        </span>
      ) : (
        <span
          className={`tabular-nums ${unlimited ? 'font-semibold text-indigo-600' : ''}`}
          title={unlimited ? 'Unlimited' : undefined}
        >
          {display}
        </span>
      )}
    </div>
  )
}