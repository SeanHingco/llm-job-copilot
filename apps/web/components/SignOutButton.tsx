'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignOutButton({ className = '' }: { className?: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onClick() {
        try {
            await supabase.auth.signOut();

            try { localStorage.removeItem('rb:credits'); } catch {}
            router.replace('/');
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`rounded-lg bg-neutral-200 px-3 py-1.5 text-gray-500 text-sm hover:bg-neutral-300 disabled:opacity-50 ${className}`}
        >
            {loading ? 'Signing out…' : 'Sign out'}
        </button>
    )
}