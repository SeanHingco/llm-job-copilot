'use client'

import Link from 'next/link'
import { useRequireAuth } from '@/lib/RequireAuth'
import ChangePasswordForm from 'components/ChangePasswordForm'

export default function PasswordPage() {
  const { ready } = useRequireAuth()
  if (!ready) return null  // wait for auth snapshot; redirect happens in the hook

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-4">
          <Link href="/account" className="text-sm text-neutral-400 hover:underline">
            ← Back to account
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl text-indigo-500 font-semibold">Change password</h1>
          <p className="text-sm text-neutral-600">Update your password below.</p>

          {/* next step: mount the actual form here */}
          <div className="mt-6 text-sm text-neutral-500">
            <ChangePasswordForm/>
          </div>
        </div>
      </div>
    </main>
  )
}
