'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ChangePasswordForm() {
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null); setOk(null);

        if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return; }
        if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // email guard
            const email = session?.user.email
            if (!email) { setError('You are signed out.'); return; }

            // current password guard
            const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
            if (reauthErr) { setError('Current password is incorrect.'); return; }

            const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
            if (updErr) { setError(updErr.message); return }

            setOk('Password updated.');
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setLoading(false);
        }

    }
    return (
            <form onSubmit={onSubmit} className="grid gap-3 max-w-md">
                {/* <h2 className="text-lg font-semibold">Change password</h2> */}

                <label className="text-sm font-medium" htmlFor="current">Current password</label>
                <input id="current" type="password" value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    className="rounded border px-3 py-2" required />
                
                <label className="text-sm font-medium" htmlFor="new">New password</label>
                <input id="new" type="password" value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className="rounded border px-3 py-2" required />
                
                <label className="text-sm font-medium" htmlFor="confirm">Confirm new password</label>
                <input id="confirm" type="password" value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className="rounded border px-3 py-2" required />

                {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
                {ok &&    <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}

                <button disabled={loading}
                    className="mt-1 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Saving…' : 'Update password'}
                </button>
            </form>
        );
}