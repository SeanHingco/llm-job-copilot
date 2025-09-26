'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api';
import { useRequireAuth } from '@/lib/RequireAuth';
import Link from 'next/link';

type PackKey = 'pack_20' | 'pack_60' | 'pack_200';
type SubKey  = 'sub_unlimited_monthly' | 'sub_unlimited_quarterly' | 'sub_unlimited_yearly';

type Me = {
  email?: string;
  plan?: string;
  free_uses_remaining?: number;
  unlimited?: boolean;
};

type SubSummary = {
    has_subscription: boolean;
    status?: string;
    plan?: string;
    plan_key?: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
};


type PackCardProps = {
  title: string;
  priceText: string;
  bullets: string[];
  priceKey: PackKey;
  onBuy: (key: PackKey) => Promise<void> | void;
  buyingKey: null | PackKey;
  disabled?: boolean;
  note?: string; 
};

type SubCardProps = {
  title: string;
  priceText: string;
  bullets: string[];
  priceKey: SubKey;
  isCurrent?: boolean;
  onChoose: (key: SubKey) => Promise<void> | void;
  onManage: () => Promise<void> | void;
  busy?: boolean;
  ribbon?: string;
};

// prices
const PACK_PRICE_CENTS: Record<PackKey, number> = {
  pack_20: 1400,
  pack_60: 3600,
  pack_200: 11100,
};

const SUB_PRICE_CENTS: Record<SubKey, number> = {
  sub_unlimited_monthly: 1900,
  sub_unlimited_quarterly: 4900,
  sub_unlimited_yearly: 14900,
};

const PACK_CREDITS: Record<PackKey, number> = {
  pack_20: 20,
  pack_60: 60,
  pack_200: 200
};

function usdPerDollar(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function usd(cents?: number) {
  if (typeof cents !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(cents / 100);
}


// reusable Pricing Cards
function PackCard({
  title,
  priceText,
  bullets,
  priceKey,
  onBuy,
  buyingKey,
  disabled = false,
  note,
}: PackCardProps) {
  const isLoading = buyingKey === priceKey;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="text-lg font-bold text-slate-800">{priceText}</div>
      </div>

      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}

      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span>•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onBuy(priceKey)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={[
          "mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium",
          "bg-indigo-600 text-white hover:bg-indigo-700",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {isLoading ? "Redirecting…" : "Buy credits"}
      </button>
    </div>
  );
}

function SubCard({
  title, priceText, bullets, priceKey, isCurrent = false,
  onChoose, onManage, busy = false, ribbon,
}: SubCardProps) {
  return (
    <div
      className={[
        "relative rounded-xl border bg-white p-4 shadow-sm",
        isCurrent ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"
      ].join(" ")}
    >
      {ribbon && (
        <div className="absolute -top-2 -left-2 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white shadow">
          {ribbon}
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="text-lg font-bold text-slate-800">{priceText}</div>
      </div>

      {isCurrent && (
        <div className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Current plan
        </div>
      )}

      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2"><span>•</span><span>{b}</span></li>
        ))}
      </ul>

      {isCurrent ? (
        <button
          onClick={() => onManage()}
          disabled={busy}
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50"
        >
          Manage in portal
        </button>
      ) : (
        <button
          onClick={() => onChoose(priceKey)}
          disabled={busy}
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Choose plan
        </button>
      )}
    </div>
  );
}


export default function Billing() {
    const { ready } = useRequireAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [loading,setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [subscribing, setSubscribing] = useState<boolean>(false);
    const [managing, setManaging] = useState<boolean>(false);
    const [completing, setCompleting] = useState<boolean>(false);
    const [buying, setBuying] = useState<null | PackKey>(null);
    const [sub, setSub] = useState<SubSummary | null>(null);

    const plan = me?.plan ?? 'free';
    const isFree = (me?.plan ?? 'free') === 'free';
    const hasSub = Boolean(sub?.has_subscription);
    const subStatus = sub?.status;
    const cancelsAtPeriodEnd = Boolean(sub?.cancel_at_period_end);

    const nextRenewal =
        sub?.has_subscription && typeof sub.current_period_end === 'number'
            ? new Date(sub.current_period_end * 1000).toLocaleDateString()
            : null;

    // price text
    const perCredit20 = PACK_PRICE_CENTS.pack_20 / PACK_CREDITS.pack_20 / 100; // dollars/credit
    const perCredit60 = PACK_PRICE_CENTS.pack_60 / PACK_CREDITS.pack_60 / 100;
    const perCredit200 = PACK_PRICE_CENTS.pack_200 / PACK_CREDITS.pack_200 / 100;
    const savingsPct500 = Math.max(
        0,
        Math.round((1 - perCredit20 / perCredit60) * 100)
    );


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
                return () => { cancelled = true };
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

    async function subscribe(priceKey: SubKey) {
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


    async function buyCredits(priceKey: PackKey) {
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
                                <span className={[
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                (me?.plan ?? 'free') === 'free' ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-700',
                                ].join(' ')}>
                                {(me?.plan ?? 'free')}
                                </span>
                                {Boolean(me?.unlimited) && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                                    Unlimited
                                </span>
                                )}
                                {/* keep the subscription status chips as you have them */}
                            </div>
                        </div>

                        {/* Credits */}
                        <div className={statBase}>
                            <div className={labelBase}>Credits left</div>
                            <div className="mt-1 text-xl font-semibold tabular-nums text-violet-500">
                                {me?.unlimited ? '∞' : (me?.free_uses_remaining ?? 0)}
                            </div>
                        </div>

                        </>
                    )}
                </div>
                <div className='mt-6 flex flex-wrap gap-2'>
                    {/* {!loading && plan !== 'free' && (
                        <div className="flex flex-wrap gap-2 mt-6">
                            <button className={subBase} onClick={() => subscribe('sub_starter')} >Subscribe: Starter</button>
                            <button className={subBase }onClick={() => subscribe('sub_plus')}>Subscribe: Plus</button>
                            <button className={subBase} onClick={() => subscribe('sub_pro')}>Subscribe: Unlimited</button>
                        </div>
                    )} */}
                    {!loading && hasSub && (
                        <div className="inline-flex ...">
                            <button onClick={manageBilling} /* ... */>
                            {managing ? 'Opening…' : 'Manage billing'}
                            </button>
                        </div>
                    )}

                    {!loading && hasSub && (
                        <p className="mt-2 text-xs text-slate-500">
                            Renews on <strong>{nextRenewal ?? '—'}</strong>. Plan changes are prorated by Stripe.
                            {' '}Cancel anytime in the{' '}
                            <button
                                type="button"
                                onClick={manageBilling}
                                className="underline underline-offset-2 hover:text-slate-700"
                            >
                                Billing Portal
                            </button>.
                            {cancelsAtPeriodEnd && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                                    Cancellation scheduled
                                </span>
                            )}
                        </p>
                    )}
                </div>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SubCard
                        title="Monthly"
                        priceText={`${usd(SUB_PRICE_CENTS.sub_unlimited_monthly)}/mo`}
                        bullets={["Unlimited usage", "Fair-use rate limits", "Manage anytime"]}
                        priceKey="sub_unlimited_monthly"
                        isCurrent={sub?.plan_key === 'sub_unlimited_monthly'}
                        onChoose={subscribe}
                        onManage={manageBilling}
                        busy={subscribing || managing || completing}
                    />
                    <SubCard
                        title="Quarterly"
                        priceText={`${usd(SUB_PRICE_CENTS.sub_unlimited_quarterly)}/3 mo`}
                        bullets={["Unlimited usage", "Save vs monthly", "Manage anytime"]}
                        priceKey="sub_unlimited_quarterly"
                        isCurrent={sub?.plan_key === 'sub_unlimited_quarterly'}
                        onChoose={subscribe}
                        onManage={manageBilling}
                        ribbon="Most popular"
                        busy={subscribing || managing || completing}
                    />
                    <SubCard
                        title="Yearly"
                        priceText={`${usd(SUB_PRICE_CENTS.sub_unlimited_yearly)}/yr`}
                        bullets={["Unlimited usage", "Best value", "Manage anytime"]}
                        priceKey="sub_unlimited_yearly"
                        isCurrent={sub?.plan_key === 'sub_unlimited_yearly'}
                        onChoose={subscribe}
                        onManage={manageBilling}
                        busy={subscribing || managing || completing}
                    />
            </div>
            {!loading && (
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <PackCard
                    title="20-Credit Pack"
                    priceText={usd(PACK_PRICE_CENTS.pack_20)}
                    note={`≈ ${usd(PACK_PRICE_CENTS.pack_20 / PACK_CREDITS.pack_20)} / credit`}
                    bullets={["One-time purchase", "Never expires", "Great for light use"]}
                    priceKey="pack_20"
                    onBuy={buyCredits}
                    buyingKey={buying}
                    disabled={loading || completing}
                    />
                    <PackCard
                    title="60-Credit Pack"
                    priceText={usd(PACK_PRICE_CENTS.pack_60)}
                    note={`≈ ${usd(PACK_PRICE_CENTS.pack_60 / PACK_CREDITS.pack_60)} / credit`}
                    bullets={["Bulk discount", "Never expires", "Popular choice"]}
                    priceKey="pack_60"
                    onBuy={buyCredits}
                    buyingKey={buying}
                    disabled={loading || completing}
                    />
                    <PackCard
                    title="200-Credit Pack"
                    priceText={usd(PACK_PRICE_CENTS.pack_200)}
                    note={`≈ ${usd(PACK_PRICE_CENTS.pack_200 / PACK_CREDITS.pack_200)} / credit`}
                    bullets={["Best value", "Never expires", "For power users"]}
                    priceKey="pack_200"
                    onBuy={buyCredits}
                    buyingKey={buying}
                    disabled={loading || completing}
                    />
                </div>
            )}

        </div>
    );
    
}