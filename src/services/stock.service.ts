/**
 * Stock service.
 *
 * Stock lives in the `stock` collection, one document per item. There is no
 * stock UI — the shop maintains these documents directly in the Firebase
 * console. The app only reads them (and a sale transaction decrements them).
 *
 * Expected document shape:
 *   { category: 'pipes' | 'sheets' | 'hardware', name: string,
 *     quantity: number, price: number }
 */

import {
  collection,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { CATEGORIES, type Category, type StockItem } from '@/types'
import { toErrorMessage } from '@/lib/errors'
import { db } from './firebase'

const stockRef = collection(db, 'stock')

export type StockItemsListener = (items: StockItem[], loaded: boolean) => void

/** Live subscription to every stock item. `loaded` is false until the first snapshot. */
export function subscribeStockItems(
  onChange: StockItemsListener,
  onError?: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    stockRef,
    (snapshot) => {
      const items = snapshot.docs
        .map((snap) => parseStockItem(snap.id, snap.data()))
        .filter((item): item is StockItem => item !== null)
      onChange(items, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load stock.'))
    },
  )
}

/** Convert a raw stock document into a `StockItem`, or null when malformed. */
export function parseStockItem(id: string, data: DocumentData | undefined): StockItem | null {
  if (!data || !isCategory(data.category) || typeof data.name !== 'string') return null
  return {
    id,
    category: data.category,
    name: data.name,
    quantity: numberOrZero(data.quantity),
    price: numberOrZero(data.price),
  }
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

export function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** QueryDocumentSnapshot overload kept for callers that already have one. */
export type StockItemSnapshot = QueryDocumentSnapshot<DocumentData>
