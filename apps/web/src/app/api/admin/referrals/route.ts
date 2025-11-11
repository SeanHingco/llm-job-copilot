// app/api/admin/referrals/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Ensure this route is dynamic (no build-time execution)
export const dynamic = 'force-dynamic';

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  if (!url || !key) {
    // Throwing here is fine; it only runs at request-time,
    // not at module import during build.
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  // ✅ Construct inside the handler
  const supabase = getAdminSupabase();

  // (Optional) simple auth gate via Bearer token from Supabase session
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // If you want to verify the token, you can:
  // const { data: { user }, error } = await supabase.auth.getUser(token)
  // if (error || !user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch referral overview rows (adjust to your schema / RPC)
  const { data, error } = await supabase
    .from('referrers_view') // or your table/view
    .select('user_id, code, total_clicks, converted_signups, last_conversion_at')
    .order('last_conversion_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
