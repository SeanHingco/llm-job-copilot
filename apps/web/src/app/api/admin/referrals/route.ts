import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase()

// Builds a Supabase client that runs AS THE USER (from the Bearer token)
function supabaseAsUser(accessToken: string | null) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' } } }
  )
}

// Service-role admin (server only)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // 1) Require user token
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 2) Load user and enforce admin email
  const sb = supabaseAsUser(token)
  const { data: u } = await sb.auth.getUser()
  const email = u?.user?.email?.toLowerCase()
  if (!email || !ADMIN_EMAIL || email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3) Fetch summary (use your SQL view if you created it; else aggregate directly)
  const { data, error } = await admin
    .from('referrer_summary') // or swap to a direct aggregate if you skipped the view
    .select('user_id,code,total_clicks,converted_signups,last_conversion_at')
    .order('converted_signups', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}
