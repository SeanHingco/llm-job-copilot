// components/HeaderGate.tsx
'use client';

import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

const HIDE_ON = ['/login', '/features']; // add '/auth' if you ever use that route

export default function HeaderGate() {
  const pathname = usePathname();
  const hide = pathname && HIDE_ON.some(p => pathname.startsWith(p));
  if (hide) return null;
  return <AppHeader />;
}
