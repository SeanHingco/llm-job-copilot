'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Make sure we actually have a valid recovery session
  useEffect(() => {
    let mounted = true;

    (async () => {
      const code = searchParams.get('code');

      try {
        if (code) {
          // 1) Exchange code for a session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // 2) Strip the code from the URL so refresh/back doesn't re-use it
          if (mounted) {
            setSessionReady(true);
            router.replace('/login/reset-password');
          }
          return;
        }

        // Fallback: if no code, just check if we already have a session
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSessionReady(Boolean(data.session));
        if (!data.session) {
          setError('This reset link is invalid or has expired. Please request a new one.');
        }
      } catch {
        if (!mounted) return;
        setSessionReady(false);
        setError('Unable to verify reset session.');
      }
    })();

    return () => { mounted = false; };
  }, [searchParams, router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setNotice('Password updated! You can sign in with your new password.');
    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("Could not update password.");
        }
    } finally {
      setSubmitting(false);
    }
  }

  // If we know there is no session, show the “expired” state
  if (sessionReady === false) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm grid gap-3">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/login/forgot-password" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Request a new reset link →
          </Link>
        </div>
      </main>
    );
  }

  // Loading state while we check the session
  if (sessionReady === null) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-sm text-neutral-400">Checking reset link…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm grid gap-3">
        <h1 className="text-2xl font-bold">Choose a new password</h1>

        <label htmlFor="password" className="text-sm">New password</label>
        <input
          id="password"
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />

        <label htmlFor="confirm" className="text-sm">Confirm password</label>
        <input
          id="confirm"
          type="password"
          required
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded border px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="text-sm text-emerald-500">
            {notice} <Link href="/login" className="underline">Go to sign in</Link>
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password || !confirm}
          className="rounded bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>

        <div className="mt-2 text-sm">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            ← Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
