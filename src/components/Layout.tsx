/**
 * App shell – navbar styled after the PrebuiltUI template.
 * Logo left · nav links + sign-out right · hamburger on mobile.
 */

import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/lib/auth'

const NAV_LINKS = [
  { to: '/form', label: 'Form' },
  { to: '/quotations', label: 'Customers' },
] as const

export function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh">
      {/* ── Navbar ── */}
      <nav className="relative flex items-center justify-between bg-white px-6 py-3 border-b border-zinc-200 md:px-16 lg:px-24">

        {/* Left: logo */}
        <NavLink to="/form" className="flex-shrink-0">
          <img
            src="/images/pallavi-logo.jpg"
            alt="Pallavi Iron Traders"
            className="h-auto object-contain w-[110px] md:w-[150px]"
            style={{ maxHeight: '56px' }}
          />
        </NavLink>

        {/* Desktop: nav links + user + sign-out */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm transition-colors ${
                  isActive
                    ? 'text-zinc-900 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <span className="truncate text-xs text-zinc-400 max-w-[180px]">{user?.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 bg-zinc-900 text-zinc-50 hover:bg-zinc-700 text-sm font-medium px-4 py-2 rounded-full border-0 cursor-pointer transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 bg-transparent border-0 p-1 cursor-pointer"
          aria-label="Toggle menu"
        >
          <span
            className="block w-6 h-0.5 bg-zinc-800 transition-transform duration-300"
            style={{ transform: menuOpen ? 'translateY(8px) rotate(45deg)' : '' }}
          />
          <span
            className="block w-6 h-0.5 bg-zinc-800 transition-opacity duration-300"
            style={{ opacity: menuOpen ? 0 : 1 }}
          />
          <span
            className="block w-6 h-0.5 bg-zinc-800 transition-transform duration-300"
            style={{ transform: menuOpen ? 'translateY(-8px) rotate(-45deg)' : '' }}
          />
        </button>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="absolute top-full left-0 w-full bg-white border-t border-zinc-200 flex flex-col p-5 gap-1 md:hidden z-50">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 font-semibold'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
              <span className="px-4 text-xs text-zinc-400 truncate">{user?.email}</span>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); void signOut() }}
                className="flex items-center justify-center bg-zinc-900 text-zinc-50 text-sm font-medium px-5 py-2.5 rounded-full border-0 cursor-pointer w-fit"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>

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
