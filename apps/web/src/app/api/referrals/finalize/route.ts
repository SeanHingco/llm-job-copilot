import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAsUser(accessToken: string | null) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' } } }
  )
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const parts = cookieHeader.split(/;\s*/g)
  for (const p of parts) {
    const [k, ...rest] = p.split('=')
    if (decodeURIComponent(k) === name) return rest.join('=')
  }
  return null
}

export async function POST(req: Request) {
  // 1) cookie + token
  const clickId = getCookie(req, 'rb_ref')
  if (!clickId) {
    const res = NextResponse.json({ ok: true, reason: 'no_cookie' })
    res.headers.append(
      'Set-Cookie',
      `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    )
    return res
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ ok: false, error: 'no_user_token' }, { status: 401 })

  // 2) user
  const sb = supabaseAsUser(token)
  const { data: u } = await sb.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return NextResponse.json({ ok: false, error: 'no_user' }, { status: 401 })

  // 3) find click row
  const { data: refRow, error: findErr } = await admin
    .from('referrals')
    .select('id, signed_up_user')
    .eq('click_id', clickId)
    .maybeSingle()

  if (!refRow || findErr) {
    const res = NextResponse.json({ ok: true, reason: 'no_click' })
    res.headers.append(
      'Set-Cookie',
      `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    )
    return res
  }

  // attach once
  if (!refRow.signed_up_user) {
    await admin
      .from('referrals')
      .update({ signed_up_user: userId, signed_up_at: new Date().toISOString() })
      .eq('id', refRow.id)
  }

  // NEW: process grants (guarded) and return them
  let grants: Array<{ granted_type: string; granted_reason: string }> = []
  if (process.env.REFERRALS_REWARDS_ENABLED === 'true') {
    try {
      const grantRes = await admin.rpc('process_referral_grants', { p_click_id: clickId })
      grants = Array.isArray(grantRes.data)
        ? grantRes.data
        : grantRes.data
        ? [grantRes.data]
        : []
    } catch (e) {
      console.warn('grant rpc skipped/failed:', e)
    }
  }

  // 4) clear cookie + return
  const res = NextResponse.json({ ok: true, grants })
  res.headers.append(
    'Set-Cookie',
    `rb_ref=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  )
  return res
}
