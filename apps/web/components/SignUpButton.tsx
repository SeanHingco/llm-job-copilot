'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignUpButton({ className = '' }: { className?: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onClick() {
        try {
            // await supabase.auth.signOut();

            // try { localStorage.removeItem('rb:credits'); } catch {}
            router.replace('/login');
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 ${className}`}
        >
            {loading ? 'Taking to Sign Up…' : 'Sign Up'}
        </button>
    )
}