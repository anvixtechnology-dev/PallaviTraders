import { useEffect, useState } from 'react'

import type { Quotation } from '@/types'
import { subscribeQuotations } from '@/services/quotations.service'

/** Saved quotations, newest first. Used to suggest the next quotation number. */
export function useQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeQuotations(
        (next, isLoaded) => {
          setQuotations(next)
          setLoaded(isLoaded)
        },
        setError,
      ),
    [],
  )

  return { quotations, loaded, error }
}
