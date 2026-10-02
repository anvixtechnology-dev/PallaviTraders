/**
 * Stock service.
 *
 * Stock is a single document (`stock/app`) holding the three counters rather
 * than one document per item, which keeps reads trivial and matches the way the
 * shop actually works.
 */

import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'

import { CATEGORIES, type Category, type Stock } from '@/types'
import { EMPTY_STOCK, sanitiseStock } from '@/lib/totals'
import { toErrorMessage } from '@/lib/errors'
import { db } from './firebase'

export const STOCK_DOC_ID = 'app'

const stockRef = doc(db, 'stock', STOCK_DOC_ID)

export type StockListener = (stock: Stock, loaded: boolean) => void

/** Live subscription to the three counters. `loaded` is false until the first snapshot. */
export function subscribeStock(onChange: StockListener, onError?: (message: string) => void): Unsubscribe {
  return onSnapshot(
    stockRef,
    (snapshot) => {
      onChange(snapshot.exists() ? sanitiseStock(snapshot.data()) : EMPTY_STOCK, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load stock.'))
    },
  )
}

/**
 * Overwrite the counters with the given values. The Stats screen uses this when
 * the admin types in a corrected quantity.
 */
export async function saveStock(stock: Stock): Promise<void> {
  const payload: Stock = { pipes: 0, sheets: 0, hardware: 0 }
  for (const category of CATEGORIES) payload[category] = Math.max(0, Math.round(stock[category] || 0))

  await setDoc(
    stockRef,
    { ...(payload as Record<Category, number>), updatedAt: Date.now() },
    { merge: true },
  )
}
