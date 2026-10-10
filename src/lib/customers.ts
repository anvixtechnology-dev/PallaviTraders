/**
 * Customer helpers.
 *
 * Sales are stored one document per transaction, so the Customers screen lists
 * them directly and only needs a search predicate. Plain functions, no React
 * and no Firestore, so they are unit testable.
 */

import type { Sale } from '@/types'

/** Free-text match over a sale's customer name, DS number or item names. */
export function saleMatches(sale: Sale, needle: string): boolean {
  const query = needle.trim().toLowerCase()
  if (!query) return true
  if (sale.nameKey.includes(query)) return true
  if (sale.dsNumber.toLowerCase().includes(query)) return true
  return sale.items.some((item) => item.itemName.toLowerCase().includes(query))
}

/** The item names on a sale that match the query, if any (used for highlighting-free search). */
export function saleItemSummary(sale: Sale): string {
  return sale.items.map((item) => item.itemName).filter(Boolean).join(', ')
}
