import { useEffect, useState } from 'react'

import type { Stock } from '@/types'
import { EMPTY_STOCK } from '@/lib/totals'
import { subscribeStock } from '@/services/stock.service'

/** Live stock counters, updated by Firestore whenever a purchase is saved. */
export function useStock() {
  const [stock, setStock] = useState<Stock>(EMPTY_STOCK)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeStock(
        (next, isLoaded) => {
          setStock(next)
          setLoaded(isLoaded)
        },
        setError,
      ),
    [],
  )

  return { stock, loaded, error }
}
