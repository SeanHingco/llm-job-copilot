'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api';
import { useRequireAuth } from '@/lib/RequireAuth';
import Link from 'next/link';

type Me = {
    email?: string;
    plan?: string;
    free_uses_remaining?: number;
}

type SubSummary = {
    has_subscription: boolean;
    status?: string;
    plan?: string;
    plan_key?: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
};

export default function Billing() {
    const { ready } = useRequireAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [loading,setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [subscribing, setSubscribing] = useState<boolean>(false);
    const [managing, setManaging] = useState<boolean>(false);
    const [completing, setCompleting] = useState<boolean>(false);
    const [buying, setBuying] = useState<null | "pack_100" | "pack_500">(null);
    const [sub, setSub] = useState<SubSummary | null>(null);

    const plan = me?.plan ?? 'free';
    const isFree = (me?.plan ?? 'free') === 'free';
    const hasSub = Boolean(sub?.has_subscription);
    const subStatus = sub?.status;
    const cancelsAtPeriodEnd = Boolean(sub?.cancel_at_period_end);

    // styling
    const statBase = 'rounded-lg border bg-slate-50 p-3';
    const labelBase = 'text-xs font-medium text-slate-500';
    const subBase = 'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed';

    // load user snapshot
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true)
                const res = await apiFetch('/me')
                if (!res.ok) {
                    const msg = await res.text()
                if (!cancelled) setError(`Error: ${msg}`)
                    return;
                }
                const data = await res.json()
                if (!cancelled) {
                    setMe(data);
                    setError(null);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!cancelled) { setError(`Error: ${msg || String(e)}`) };
            } finally {
                if (!cancelled) { 
                    setLoading(false);
                 };
            }
        })()
        return () => { cancelled = true };
    },[]);

    useEffect(() => {
    (async () => {
        try {
            const res = await apiFetch<SubSummary>("/billing/subscription-summary");
            if (res.ok) setSub(res.data || null);
        } catch {}
        })();
    }, []);

    // handle checkout return
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const sid = p.get('session_id');
        if (!sid) return;

        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());

        let cancelled = false;
        (async () => {
                try {
                    setCompleting(true);
                    const res = await apiFetch('/billing/complete-subscription', {
                        method: 'POST',
                        body: JSON.stringify({ session_id: sid }),
                    });
                    if (!res.ok) {
                        const msg = await res.text();
                        if (!cancelled) setError(`Error completing subscription: ${msg}`);
                        return;
                    }

                    // Refresh snapshot
                    const meRes = await apiFetch('/me');
                    if (meRes.ok) {
                        const data = await meRes.json();
                    if (!cancelled) {
                        setMe(data);
                        setError(null);
                    }
                    }
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (!cancelled) setError(`Error: ${msg || String(e)}`);
                } finally {
                    if (!cancelled) setCompleting(false);
                }
        })()
    },[]);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.get("checkout") !== "success" || !p.get("key")) return;

        // remove the query params from the URL
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        url.searchParams.delete("key");
        window.history.replaceState({}, "", url.toString());

        // optional: refresh user snapshot (credits won't change until webhook exists,
        // but this is where it will reflect once we add that next step)
        (async () => {
            try {
            const meRes = await apiFetch("/me");
            if (meRes.ok) {
                const data = await meRes.json();
                setMe(data);
                setError(null);
            }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(`Error: ${msg || String(e)}`);
            }
        })();
    }, []);

    if (!ready) return null;

    async function subscribe(priceKey: 'sub_starter'|'sub_plus'|'sub_pro') {
        if (subscribing || loading || completing) return;
        setError(null); setSubscribing(true);
        try {
            const res = await apiFetch('/billing/checkout', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ price_key: priceKey }),
            });
            if (!res.ok) { setError(`Error: ${await res.text()}`); setSubscribing(false); return; }
            const { url } = await res.json(); if (url) window.location.assign(url); else setError('No Checkout URL');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Error: ${msg || String(e)}`);
        } finally {
            setSubscribing(false);
        }
    }


    async function buyCredits(priceKey: "pack_100" | "pack_500") {
        if (buying) return;
        setError(null);
        setBuying(priceKey);
        try {
            const res = await apiFetch<{ url?: string }>("/billing/checkout", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ price_key: priceKey }),
            });
            if (res.ok && res.data?.url) {
            window.location.assign(res.data.url);
            } else {
                const msg = await res.text();
                setError(`Error starting checkout: ${msg || "Unknown error"}`);
                setBuying(null);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Error: ${msg || String(e)}`);
            setBuying(null);
        }
    }

    async function manageBilling() {
        if (managing || loading || completing) return;
        setError(null); setManaging(true);

        try {
            const res = await apiFetch('/billing/portal');
            if (res.status === 401) {
                setError('Please sign in');
                setManaging(false);
                return;
            }
            if (!res.ok) {
                const msg = await res.text();
                setError(`Error: ${msg}`);
                setManaging(false);
                return;
            }
            const { url } = await res.json();
            if (url) {
                window.location.href = url;
            } else {
                setError('No portal URL');
                setManaging(false);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Error: ${msg || String(e)}`);
            setManaging(false);
        }
    }

    return (
        <div className='max-w-3xl mx-auto p-8 px-4 space-y-4'>
            <div className="mb-4">
                <Link href="/account" className="text-sm text-neutral-400 hover:underline">
                    ← Back to account
                </Link>
            </div>
            <h1 className='text-2xl font-bold'>Billing</h1>
            <h2 className='text-sm text-neutral-300'>Manage your plan and credits</h2>
            <div className='bg-white border rounded-2xl shadow-sm p-6'>
                {loading && ( 
                    <div className='mb-4 inline-flex items-center gap-2 text-slate-700'>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                        <span>Loading…</span>
                    </div>
                )}
                {error && ( 
                    <div 
                        className='mt-3 rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm'
                        role='status'
                        aria-live='polite'
                    >
                        {error}
                    </div> 
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {!loading && me && (
                        <>
                        {/* Email */}
                        <div className={statBase}>
                            <div className={labelBase}>Email</div>
                            <div className="mt-1 text-sm text-slate-900">{me.email ?? '—'}</div>
                        </div>

                        {/* Plan */}
                        <div className={statBase}>
                            <div className={labelBase}>Plan</div>
                            <div className="mt-1 flex items-center gap-2">
                                <span
                                className={[
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                    isFree ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-700',
                                ].join(' ')}
                                >
                                {plan}
                                </span>

                                {/* subtle status chips, only if there is a subscription */}
                                {hasSub && subStatus && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                    {subStatus}
                                </span>
                                )}
                                {hasSub && cancelsAtPeriodEnd && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                    Cancels at period end
                                </span>
                                )}
                            </div>
                        </div>

                        {/* Credits */}
                        <div className={statBase}>
                            <div className={labelBase}>Credits left</div>
                            <div className="mt-1 text-xl font-semibold tabular-nums text-violet-500">
                            {me.free_uses_remaining ?? 0}
                            </div>
                        </div>
                        </>
                    )}
                </div>
                <div className='mt-6 flex flex-wrap gap-2'>
                    {!loading && plan === 'free' && (
                        <div className="flex flex-wrap gap-2 mt-6">
                            <button className={subBase} onClick={() => subscribe('sub_starter')} >Subscribe: Starter</button>
                            <button className={subBase }onClick={() => subscribe('sub_plus')}>Subscribe: Plus</button>
                            <button className={subBase} onClick={() => subscribe('sub_pro')}>Subscribe: Unlimited</button>
                        </div>
                    )}
                    {!loading && plan !== 'free' && (
                        <div className=
                            'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                            <button onClick={manageBilling} disabled={managing || completing} aria-busy={managing || completing}>
                                {managing ? 'Opening…' : 'Manage billing'}
                            </button>
                        </div>
                    )}

                    {!loading && plan !== 'free' &&(
                        <>
                        <button
                            onClick={() => buyCredits("pack_100")}
                            disabled={buying === "pack_100" || loading || completing}
                            aria-busy={buying === "pack_100"}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {buying === "pack_100" ? "Redirecting…" : "Buy 100 credits"}
                        </button>

                        <button
                            onClick={() => buyCredits("pack_500")}
                            disabled={buying === "pack_500" || loading || completing}
                            aria-busy={buying === "pack_500"}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {buying === "pack_500" ? "Redirecting…" : "Buy 500 credits"}
                        </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
    
}