// SERVER ONLY — do not expose the service role key to the client!
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


export async function POST(req: Request) {
  try {
    const { user_id, new_password } = await req.json()
    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id and new_password required' }, { status: 400 })
    }
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // <-- service role (server only)
    )
    const { error } = await supa.auth.admin.updateUserById(user_id, { password: new_password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || 'unknown' }, { status: 500 })
  }
}
