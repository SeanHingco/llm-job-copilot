// app/r/[code]/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type RouteContext = {
  params: { code: string }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
)

export async function GET(req: NextRequest, ctx: RouteContext) {
  const url = new URL(req.url)
  const code = decodeURIComponent(ctx.params.code || '').trim()
  if (!code) return NextResponse.redirect(new URL('/login', url))

  // ensure code exists
  const { data: referrer } = await supabaseAdmin
    .from('referrers')
    .select('code')
    .eq('code', code)
    .maybeSingle()

  if (!referrer) {
    return NextResponse.redirect(new URL('/login?ref=invalid', url))
  }

  // read headers from the request
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    ''
  const ua = req.headers.get('user-agent') || ''

  const clickId = crypto.randomUUID()

  await supabaseAdmin.from('referrals').insert({
    code,
    click_id: clickId,
    ip,
    ua,
  })

  const res = NextResponse.redirect(new URL('/login?src=ref', url))
  res.cookies.set('rb_ref', clickId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
