import { Component, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/components/AuthProvider'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { CustomersPage } from '@/pages/CustomersPage'
import { FormPage } from '@/pages/FormPage'
import { LoginPage } from '@/pages/LoginPage'
import { StatsPage } from '@/pages/StatsPage'

/** Blocks the app until Firebase has restored the session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth()

  if (initialising) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Starting PALLAVI TRADERS…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

/**
 * Keeps a signed-in user off the login screen. Signing in succeeds without this:
 * the session is live, but nothing navigates away, so the form just sits there
 * looking like a dead button. Also covers a refresh on /login and the back
 * button after signing out.
 */
function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth()

  if (initialising) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Starting PALLAVI TRADERS…</p>
      </div>
    )
  }

  if (user) return <Navigate to="/stats" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfSignedIn>
                  <LoginPage />
                </RedirectIfSignedIn>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/stats" replace />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/form" element={<FormPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="*" element={<Navigate to="/stats" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

/** Last-resort guard so a rendering bug never leaves a blank white screen. */
class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  override state = { message: null }

  static getDerivedStateFromError(error: unknown) {
    return { message: toErrorMessage(error, 'An unexpected error occurred.') }
  }

  override render() {
    if (this.state.message) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-100 px-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">PALLAVI TRADERS</h1>
          <p className="max-w-md text-sm text-slate-600">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Reload the page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
