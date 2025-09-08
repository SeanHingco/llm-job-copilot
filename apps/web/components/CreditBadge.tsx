import React from 'react'

type CreditProps = {
  value?: number
  loading?: boolean
}

export default function CreditBadge({ value, loading }: CreditProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
      <span className="font-medium">Credits:</span>
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          updating…
        </span>
      ) : (
        <span className="tabular-nums">{value ?? '—'}</span>
      )}
    </div>
  )
}