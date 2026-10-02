/**
 * Auth context definition.
 *
 * The context object and the `useAuth` hook live here (no JSX) and the provider
 * component lives in `components/AuthProvider.tsx`, which keeps this file free
 * of component exports.
 */

import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export interface AuthContextValue {
  user: User | null
  /** True until Firebase has restored the persisted session. */
  initialising: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
