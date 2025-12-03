'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

type AuthState = {
  ready: boolean;
  user: User | null;
};

export function useOptionalAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ready: false, user: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setState({ ready: true, user: data.user ?? null });
        }
      } catch {
        if (!cancelled) {
          setState({ ready: true, user: null });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}