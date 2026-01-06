// api.ts
import { supabase } from '@/lib/supabaseClient'
import { Draft } from './types';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')

// guest mode logic
const GUEST_ID_STORAGE_KEY = 'rb:guest_id';

function getOrCreateGuestId(): string | null {
  // avoid touching window/localStorage during SSR
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;

    const id = (globalThis.crypto?.randomUUID?.() ??
      // very cheap fallback if randomUUID isn’t available
      `guest_${Math.random().toString(36).slice(2)}_${Date.now()}`);

    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, id);
    return id;
  } catch {
    // if localStorage is blocked, just bail; backend will treat as anonymous
    return null;
  }
}

export type ApiResponse<T = unknown> = Response & { data: T | null };

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token

  if (process.env.NODE_ENV !== 'production') {
    console.log('[apiFetch] session?', !!sess.session, sess.session?.user?.email)
  }

  const headers = new Headers(init.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    const guestId = getOrCreateGuestId()
    if (guestId) {
      headers.set('x-guest-id', guestId)
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[apiFetch] sending Authorization?', headers.has('Authorization'))
  }

  // don't force JSON for form-like bodies
  const body = init.body;
  const isFormLike =
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || (ArrayBuffer.isView && ArrayBuffer.isView(body))))

  if (init.body && !headers.has('Content-Type') && !isFormLike) {
    headers.set('Content-Type', 'application/json')
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers })
  } catch (err) {
    console.error('[apiFetch] Network error:', err);
    // Return a synthetic 503 response so the app doesn't crash on null/undefined response
    return {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers(),
      redirected: false,
      type: 'error',
      url,
      clone: function () { return this as unknown as Response },
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      formData: async () => new FormData(),
      json: async () => ({ error: 'Service Unavailable' }),
      text: async () => '',
      data: null
    } as ApiResponse<T>;
  }

  // check status for session expiration
  if (res.status === 401) {
    if (typeof window !== undefined) {
      try {
        const { data } = await supabase.auth.getSession();
        const hasSession = Boolean(data.session);
        const onLogin = window.location.pathname.startsWith('/login');

        if (!hasSession && !onLogin) {
          const next = window.location.pathname + window.location.search;
          window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        }
      } catch {
        // ignore; fall back to returning the response
      }
    }
  }


  // parse JSON from a clone so the original body remains readable by callers
  let parsed: T | null = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try { parsed = await res.clone().json() as T } catch { parsed = null }
  }

  const augmented = Object.assign(res, { data: parsed as T | null }) as ApiResponse<T>;
  return augmented;
}

export async function getHistoryList(limit = 50): Promise<Draft[]> {
  const res = await apiFetch<Draft[]>(`/history?limit=${limit}`);
  return res.data || [];
}

export async function getHistoryDetail(draftId: string): Promise<Draft | null> {
  const res = await apiFetch<Draft>(`/history/${draftId}`);
  return res.data;
}

export async function deleteHistoryDraft(draftId: string): Promise<void> {
  const res = await apiFetch<{ success: boolean; message: string }>(`/history/${draftId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(res.data?.message || 'Failed to delete draft');
  }
}