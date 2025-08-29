import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined
}

export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

if (!globalThis.__supabase__) globalThis.__supabase__ = supabase
