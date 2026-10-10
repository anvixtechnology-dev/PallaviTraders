import { useEffect, useState } from 'react'

import type { Sale } from '@/types'
import { subscribeSales } from '@/services/sales.service'

/** The permanent sales ledger, newest first. */
export function useSales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeSales(
        (next, isLoaded) => {
          setSales(next)
          setLoaded(isLoaded)
        },
        setError,
      ),
    [],
  )

  return { sales, loaded, error }
}
