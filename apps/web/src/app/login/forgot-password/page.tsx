'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setNotice(null);
        setError(null);
        setSubmitting(true);

        try {
            const redirectTo = `${window.location.origin}/login/reset-password`; // where the link will land
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
            });
            if (error) throw error;

            setNotice('If that email exists, we just sent a reset link.');
        } catch (err: any) {
            setError(err?.message || 'Could not send reset link.');
        } finally {
            setSubmitting(false);
        }
    }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm grid gap-3">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-neutral-400">
          We’ll email you a link to reset your password.
        </p>

        <label htmlFor="email" className="text-sm">Email</label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-emerald-500" aria-live="polite">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !email}
          className="rounded bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
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
