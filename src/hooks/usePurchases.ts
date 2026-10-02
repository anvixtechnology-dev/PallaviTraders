import { useEffect, useState } from 'react'

import type { Purchase } from '@/types'
import { subscribePurchases } from '@/services/purchases.service'

/** The permanent customer ledger, newest purchase first. */
export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribePurchases(
        (next, isLoaded) => {
          setPurchases(next)
          setLoaded(isLoaded)
        },
        setError,
      ),
    [],
  )

  return { purchases, loaded, error }
}
