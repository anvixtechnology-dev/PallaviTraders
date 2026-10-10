import { useEffect, useState } from 'react'

import type { StockItem } from '@/types'
import { subscribeStockItems } from '@/services/stock.service'

/**
 * Live stock items from the `stock` collection. There is no way to edit them in
 * the app — they are maintained in the Firebase console.
 */
export function useStockItems() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeStockItems(
        (next, isLoaded) => {
          setItems(next)
          setLoaded(isLoaded)
        },
        setError,
      ),
    [],
  )

  return { items, loaded, error }
}
