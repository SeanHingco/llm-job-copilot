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


type PackCardProps = {
  title: string;
  priceText: string;
  bullets: string[];
  priceKey: "pack_100" | "pack_500";
  onBuy: (key: "pack_100" | "pack_500") => Promise<void> | void;
  buyingKey: null | "pack_100" | "pack_500";
  disabled?: boolean;
  note?: string; 
};

type SubCardProps = {
  title: string;
  priceText: string;
  bullets: string[];
  priceKey: 'sub_starter'|'sub_plus'|'sub_pro';
  isCurrent?: boolean;
  onChoose: (key: 'sub_starter'|'sub_plus'|'sub_pro') => Promise<void> | void;
  onManage: () => Promise<void> | void;
  busy?: boolean;
  ribbon?: string;
};

// prices
const PACK_PRICE_CENTS: Record<"pack_100" | "pack_500", number> = {
  pack_100: 900,
  pack_500: 3500,
};

const SUB_PRICE_CENTS: Record<'sub_starter'|'sub_plus'|'sub_pro', number> = {
  sub_starter: 900,
  sub_plus: 1800,
  sub_pro: 6000,
};

const PACK_CREDITS: Record<"pack_100" | "pack_500", number> = {
  pack_100: 100,
  pack_500: 500,
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
        <div className="text-lg font-bold text-slate-800">{priceText}/mo</div>
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
    const [buying, setBuying] = useState<null | "pack_100" | "pack_500">(null);
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
    const perCredit100 = PACK_PRICE_CENTS.pack_100 / PACK_CREDITS.pack_100 / 100; // dollars/credit
    const perCredit500 = PACK_PRICE_CENTS.pack_500 / PACK_CREDITS.pack_500 / 100;
    const savingsPct500 = Math.max(
        0,
        Math.round((1 - perCredit500 / perCredit100) * 100)
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
                    {/* {!loading && plan !== 'free' && (
                        <div className="flex flex-wrap gap-2 mt-6">
                            <button className={subBase} onClick={() => subscribe('sub_starter')} >Subscribe: Starter</button>
                            <button className={subBase }onClick={() => subscribe('sub_plus')}>Subscribe: Plus</button>
                            <button className={subBase} onClick={() => subscribe('sub_pro')}>Subscribe: Unlimited</button>
                        </div>
                    )} */}
                    {!loading && plan !== 'free' && (
                        <div className=
                            'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                            <button onClick={manageBilling} disabled={managing || completing} aria-busy={managing || completing}>
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
                    title="Starter"
                    priceText={usd(SUB_PRICE_CENTS.sub_starter)}
                    bullets={["100 credits / month", "Email support", "Prorated on changes"]}
                    priceKey="sub_starter"
                    isCurrent={sub?.plan_key === 'sub_starter'}
                    onChoose={subscribe}
                    onManage={manageBilling}
                    busy={subscribing || managing || completing}
                />

                <SubCard
                    title="Plus"
                    priceText={usd(SUB_PRICE_CENTS.sub_plus)}
                    bullets={["250 credits / month", "Priority support", "Prorated on changes"]}
                    priceKey="sub_plus"
                    isCurrent={sub?.plan_key === "sub_plus"}
                    onChoose={subscribe}
                    onManage={manageBilling}
                    ribbon="Most popular"
                    busy={subscribing || managing || completing}
                />

                <SubCard
                    title="Pro"
                    priceText={usd(SUB_PRICE_CENTS.sub_pro)}
                    bullets={["Unlimited credits", "Priority support", "Best for heavy use"]}
                    priceKey="sub_pro"
                    isCurrent={sub?.plan_key === "sub_pro"}
                    onChoose={subscribe}
                    onManage={manageBilling}
                    busy={subscribing || managing || completing}
                />
            </div>
            {!loading && plan !== 'free' &&(
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <PackCard
                        title="100-Credit Pack"
                        priceText={usd(PACK_PRICE_CENTS.pack_100)}
                        note={`≈ ${usdPerDollar(perCredit100)}/credit`}
                        bullets={["One-time purchase", "Never expires", "Great for light use"]}
                        priceKey="pack_100"
                        onBuy={buyCredits}
                        buyingKey={buying}
                        disabled={loading || completing}
                    />
                    <PackCard
                        title="500-Credit Pack"
                        priceText={usd(PACK_PRICE_CENTS.pack_500)}
                        note={`≈ ${usdPerDollar(perCredit500)}/credit${savingsPct500 ? ` • Save ${savingsPct500}%` : ""}`}
                        bullets={["Bulk discount", "Never expires", "Best value for power users"]}
                        priceKey="pack_500"
                        onBuy={buyCredits}
                        buyingKey={buying}
                        disabled={loading || completing}
                    />
                </div>
            )}

        </div>
    );
    
}