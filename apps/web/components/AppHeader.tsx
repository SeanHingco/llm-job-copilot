// components/AppHeader.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from 'components/SignOutButton'

const link = (href: string, label: string, cur: string) => (
  <Link
    href={href}
    className={[
      'px-2 py-1 rounded-md text-sm',
      cur.startsWith(href) ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100'
    ].join(' ')}
  >
    {label}
  </Link>
)

export default function AppHeader() {
  const pathname = usePathname() || '/'
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          {link('/draft', 'Application Insights', pathname)}
          {link('/account', 'Account', pathname)}
          {/* {link('/legal/privacy', 'Privacy', pathname)}
          {link('/legal/terms', 'Terms', pathname)} */}
          {/* {link('/account/billing', 'Billing', pathname)}
          {link('/account/password', 'Password', pathname)} */}
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
