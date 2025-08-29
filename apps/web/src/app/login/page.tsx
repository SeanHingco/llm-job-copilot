'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');

    const router = useRouter();
    const params = useSearchParams();
    const next = params.get('next') || '/draft';

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.replace(next)
        })
    }, [router, next])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        console.log('SB URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
        try {
            if (mode === 'signin') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) { setError(error.message); return }
                await waitForSession();
                router.replace(next);
            } else {
            const emailRedirectTo = typeof window !== 'undefined'
                ? `${window.location.origin}/login`
                : undefined
            const { data, error } = await supabase.auth.signUp({
                email, password, options: { emailRedirectTo }
            })
                if (error) { setError(error.message); return }
                if (data.session) {
                    await waitForSession()
                    router.replace(next)
                } else {
                    setError('Check your email to confirm, then sign in.')
                }
            }
        } catch (err: any) {
            console.log('✖ signIn threw', err);
            setError(err?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }

    async function waitForSession(timeoutMs = 4000) {
        const start = Date.now()
        for (;;) {
            const { data } = await supabase.auth.getSession()
            if (data.session) return data.session
            if (Date.now() - start > timeoutMs) throw new Error('Session not established in time')
            await new Promise(r => setTimeout(r, 60))
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <form onSubmit={onSubmit} className="w-full max-w-sm grid gap-3">
                <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded border px-3 py-2"
                    required
                />
                <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded border px-3 py-2"
                    required
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
                <button disabled={loading} className="rounded bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-white disabled:opacity-50">
                    {loading ? 'Please wait…' : 'Sign in'}
                </button>
                <div className="text-sm mt-2 text-indigo-500 hover:text-indigo-700">
                    {mode === 'signin' ? (
                        <button type="button" onClick={() => { setMode('signup'); setError(null); }}>
                            Create an account
                        </button>
                    ) : (
                        <button type="button" onClick={() => { setMode('signin'); setError(null); }}>
                            I already have an account
                        </button>
                    )}
                </div>
            </form>
        </main>
    )
}
