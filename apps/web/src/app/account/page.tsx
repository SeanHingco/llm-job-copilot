'use client'

import Link from 'next/link';
import ReferralCard from 'components/ReferralCard';
import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/lib/RequireAuth';
import { supabase } from '@/lib/supabaseClient';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@resumebender.com";

export default function AccountPage() {
    const { ready } = useRequireAuth();
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setEmail(data.session?.user?.email ?? '');
        })
    }, []);

    if (!ready) return null;

    return (
        <main className="min-h-screen p-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <h1 className="text-2xl font-semibold">Account</h1>

                <div className="rounded-2xl border bg-white p-6 shadow-sm">
                    <div className="text-sm text-neutral-600 mb-1">Signed in as</div>
                    <div className="font-medium text-slate-600">{email || '—'}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Link href="/account/billing" className="rounded-2xl border bg-white p-6 shadow-sm hover:bg-neutral-200">
                        <div className="text-lg text-bold text-neutral-900 font-medium">Billing</div>
                        <div className="text-sm text-neutral-600">Manage credits & subscription</div>
                    </Link>

                    <Link href="/account/password" className="rounded-2xl border bg-white p-6 shadow-sm hover:bg-neutral-200">
                        <div className="text-lg text-bold text-neutral-900 font-medium">Password</div>
                        <div className="text-sm text-neutral-600">Change your password</div>
                    </Link>
                    <div className="sm:col-span-2">
                        <ReferralCard />
                    </div>
                </div>

                <section className="mt-6 rounded-lg border bg-white p-4">
                    <h2 className="text-base text-neutral-900 font-semibold">Support</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                        Questions or billing issues? Email{" "}
                        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                    </p>
                </section>
            </div>
        </main>
    )
}