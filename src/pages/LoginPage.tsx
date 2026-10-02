/**
 * Sign-in screen. Firebase Authentication guards every record, so this is the
 * only way into the app.
 */

import { useState } from 'react'

import { useAuth } from '@/lib/auth'
import { isAuthSetupError } from '@/lib/errors'
import { Banner, Button, Field, TextInput } from '@/components/ui'

export function LoginPage() {
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupProblem, setSetupProblem] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter both your email address and password.')
      return
    }
    setBusy(true)
    setError(null)
    setSetupProblem(false)
    try {
      await signIn(trimmedEmail, password)
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not sign in.')
      setSetupProblem(isAuthSetupError(signInError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-wide text-slate-900">PALLAVI TRADERS</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
        </div>

        {/* noValidate: the browser's own email check silently refuses to submit on a
            stray space or a pasted character, which looks like a dead button. Checking
            here instead means a bad entry always produces a visible message. */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="admin@example.com"
              autoFocus
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
          </Field>

          {error ? <Banner tone="error">{error}</Banner> : null}

          {setupProblem ? (
            <p className="text-xs text-slate-500">
              Enable <strong>Email/Password</strong> under Firebase console → Authentication → Sign-in
              method, then create an admin user under Authentication → Users.
            </p>
          ) : null}

          <Button type="submit" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
