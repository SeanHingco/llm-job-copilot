// app/api/referrals/finalize/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // avoid prerender
export const revalidate = 0;

function getAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  if (!url || !key) {
    // Will only throw at request-time (not build) after this change
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAsUser(accessToken: string | null): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' } },
  });
}

function getCookie(req: NextRequest, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(/;\s*/g)) {
    const [k, ...rest] = part.split('=');
    if (decodeURIComponent(k) === name) return rest.join('=');
  }
  return null;
}

export async function POST(req: NextRequest) {
  // 1) cookie + token
  const clickId = getCookie(req, 'rb_ref');
  if (!clickId) {
    const res = NextResponse.json({ ok: true, reason: 'no_cookie' });
    res.headers.append(
      'Set-Cookie',
      `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return res;
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: 'no_user_token' }, { status: 401 });

  // 2) user
  const sb = supabaseAsUser(token);
  const { data: u } = await sb.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: 'no_user' }, { status: 401 });

  // 3) find click row (admin client created at request-time)
  const admin = getAdmin();
  const { data: refRow, error: findErr } = await admin
    .from('referrals')
    .select('id, signed_up_user')
    .eq('click_id', clickId)
    .maybeSingle();

  if (!refRow || findErr) {
    const res = NextResponse.json({ ok: true, reason: 'no_click' });
    res.headers.append(
      'Set-Cookie',
      `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return res;
  }

  // attach once
  if (!refRow.signed_up_user) {
    await admin
      .from('referrals')
      .update({ signed_up_user: userId, signed_up_at: new Date().toISOString() })
      .eq('id', refRow.id);
  }

  // Optional: grant rewards
  let grants: Array<{ granted_type: string; granted_reason: string }> = [];
  if (process.env.REFERRALS_REWARDS_ENABLED === 'true') {
    try {
      const grantRes = await admin.rpc('process_referral_grants', { p_click_id: clickId });
      grants = Array.isArray(grantRes.data)
        ? grantRes.data
        : grantRes.data
        ? [grantRes.data]
        : [];
    } catch (e) {
      console.warn('grant rpc skipped/failed:', e);
    }
  }

  // 4) clear cookie + return
  const res = NextResponse.json({ ok: true, grants });
  res.headers.append(
    'Set-Cookie',
    `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
  return res;
}
