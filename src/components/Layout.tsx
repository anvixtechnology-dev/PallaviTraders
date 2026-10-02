/**
 * App shell: the shop name at the top of every page and the only three
 * navigation links the app has.
 */

import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'

const NAV_LINKS = [
  { to: '/stats', label: 'Stats' },
  { to: '/form', label: 'Form' },
  { to: '/customers', label: 'Customers' },
] as const

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-lg font-bold tracking-wide text-slate-900">PALLAVI TRADERS</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-3xl px-4">
          <ul className="-mb-px flex gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-block border-b-2 px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

/** Page heading used under the nav. */
export function PageHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
    </div>
  )
}
