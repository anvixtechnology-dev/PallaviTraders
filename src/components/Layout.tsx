/**
 * App shell: the shop name at the top of every page and the only two
 * navigation links the app has.
 */

import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'

const NAV_LINKS = [
  { to: '/form', label: 'Form' },
  { to: '/quotations', label: 'Customers' },
] as const

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">
              PALLAVI IRON TRADERS
            </h1>
            <p className="text-xs text-stone-500">Quotation Management</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-xs text-stone-500 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-5xl px-4 sm:px-5">
          <ul className="-mb-px flex gap-2">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 border-b-2 px-2.5 py-2 text-sm transition-colors ${
                      isActive
                        ? 'border-stone-900 text-stone-900'
                        : 'border-transparent text-stone-500 hover:text-stone-900'
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

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5">
        <Outlet />
      </main>
    </div>
  )
}

/** Page heading used under the nav. */
export function PageHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{title}</h2>
      {description ? <p className="text-sm text-stone-500">{description}</p> : null}
    </div>
  )
}
