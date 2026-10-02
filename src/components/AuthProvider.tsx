import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'

import { AuthContext, type AuthContextValue } from '@/lib/auth'
import { AppError, toAuthErrorMessage } from '@/lib/errors'
import { auth } from '@/services/firebase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setInitialising(false)
    })
    return unsubscribe
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (error) {
      // Keep the original as `cause`: the message is friendlier, but the code is
      // what tells the login screen whether this is a setup problem it can fix.
      throw new AppError(toAuthErrorMessage(error), { cause: error })
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, initialising, signIn, signOut }),
    [user, initialising, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
