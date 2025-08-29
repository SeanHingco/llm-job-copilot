'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { apiFetch } from '@/lib/api'

async function ping() {
  const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/whoami`)
  console.log(await res.json())
}

export default function AuthPage() {
    const[email, setEmail] = useState('');
    const [msg, setMsg] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/debug` }
        });
        setMsg(error ? `Error: ${error.message}` : 'Check your email for the link.');
    };

    return (
        <main className=''>
            <h1>Sign In</h1>
            <form onSubmit={onSubmit}>
                <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit">Send magic link</button>
            </form>
            {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
        </main>
    );
}