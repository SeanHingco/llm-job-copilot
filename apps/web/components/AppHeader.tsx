// components/AppHeader.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from 'components/SignOutButton'
import SignUpButton from 'components/SignUpButton'
import Brand from 'components/Brand'
import { ThemeToggle } from 'components/ThemeToggle';
import {useEffect, useRef, useState} from 'react';
import { useOptionalAuth } from '@/lib/hooks/useOptionalAuth';


const link = (href: string, label: string, cur: string) => (
  <Link
    href={href}
    className={[
      'px-2 py-1 rounded-md text-sm',
      cur.startsWith(href) ? 'bg-background text-foreground' : 'text-foreground hover:bg-background'
    ].join(' ')}
  >
    {label}
  </Link>
)

export default function AppHeader() {
  const pathname = usePathname() || '/'
  const hide = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/forgot-password');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { ready, user } = useOptionalAuth();
  const isGuest = !user;


  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClickAway = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickAway);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return hide ? null : (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto max-w-5xl px-4 py-3 flex items-center gap-3 justify-between">
        <Brand />
        {/* Mobile overflow menu trigger */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="appheader-mobile-menu"
            onClick={() => setOpen(v => !v)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md ring-1 ring-black/10 hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {open && (
            <div
              id="appheader-mobile-menu"
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg ring-1 ring-black/10 p-1 z-50"
            >
              <Link href="/draft" role="menuitem" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-black/5">Application Insights</Link>
              <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-black/5">Account</Link>
              <Link href="/blog" role="menuitem" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-black/5">Blog</Link>
              <ThemeToggle/>
              <div className="my-1 h-px bg-black/10" />
              <div className="px-1 py-1">
                {isGuest ? (
                  <SignUpButton className="w-full justify-center" />
                ) : 
                  <SignOutButton className="w-full justify-center" />}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {link('/draft', 'Application Insights', pathname)}
          {link('/account', 'Account', pathname)}
          {link('/blog', 'Blog', pathname)}
          {/* {link('/legal/privacy', 'Privacy', pathname)}
          {link('/legal/terms', 'Terms', pathname)} */}
          {/* {link('/account/billing', 'Billing', pathname)}
          {link('/account/password', 'Password', pathname)} */}
          <ThemeToggle/>
        </div>
        <div className="hidden md:block">
          {isGuest ? (
            <SignUpButton/>
          ) : 
            <SignOutButton/>}
        </div>
      </div>
    </header>
  )
}
