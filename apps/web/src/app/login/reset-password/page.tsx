// app/login/reset-password/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const code = searchParams.get('code');
      const errDesc = searchParams.get('error_description') || searchParams.get('error');

      try {
        if (errDesc) throw new Error(errDesc);
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code); // string param
          if (error) throw error;
          if (mounted) {
            setReady(true);
            // strip ?code=... so refresh/back doesn't reuse it
            router.replace('/login/reset-password');
          }
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) setReady(true);
        else {
          setExpired(true);
          setErrorMsg('This reset link is invalid or has expired. Please request a new one.');
        }
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setExpired(true);
        setErrorMsg(msg || 'Unable to verify reset session.');
      }
    })();
    return () => { mounted = false; };
  }, [searchParams, router]);

  if (expired) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm grid gap-3">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-sm text-neutral-400">{errorMsg}</p>
          <Link href="/login/forgot-password" className="text-indigo-500 underline">
            Request a new reset link →
          </Link>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p>Checking reset link…</p>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setErrorMsg(error.message);
    router.replace('/login?reset=success');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm grid gap-3">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <input
          type="password"
          required
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button className="rounded bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-white">
          Update password
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center p-4">Checking…</main>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
