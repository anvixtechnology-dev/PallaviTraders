/**
 * Customer grouping.
 *
 * There is no separate customer document: one purchase is one entry for one
 * customer, so the same person appears in `purchases` many times. Everything on
 * the Customers screen is built by folding those purchases into one summary per
 * customer, keyed on `nameKey` — the normalised (trimmed, collapsed, lowercase)
 * name stored with each purchase. "Ramesh Traders" and "ramesh  traders" are
 * therefore one customer, and the name is shown using the spelling from their most
 * recent purchase.
 *
 * Plain functions, no React and no Firestore, so the totals are unit testable.
 */

import { CATEGORIES, type Category, type Purchase, type Stock } from '@/types'
import { sumMoney } from './money'
import { quantitiesByCategory } from './totals'

export interface CustomerSummary {
  /** Normalised name; the grouping key. */
  key: string
  /** Name exactly as written on the most recent purchase. */
  name: string
  /** Every purchase for this customer, newest first. */
  purchases: Purchase[]
  /** Distinct DS numbers seen, in most-recent-first order. */
  dsNumbers: string[]
  purchaseCount: number
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  /** Quantity bought per category across all their purchases. */
  quantities: Stock
  /** `YYYY-MM-DD` of the earliest purchase. */
  firstDate: string
  /** `YYYY-MM-DD` of the most recent purchase. */
  lastDate: string
}

/** Newest business date first; `createdAt` breaks ties within the same day. */
function byNewest(a: Purchase, b: Purchase): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.createdAt - a.createdAt
}

function summarise(key: string, sorted: readonly Purchase[]): CustomerSummary {
  const dsNumbers: string[] = []
  for (const purchase of sorted) {
    if (purchase.dsNumber && !dsNumbers.includes(purchase.dsNumber)) {
      dsNumbers.push(purchase.dsNumber)
    }
  }

  return {
    key,
    name: sorted[0].customerName,
    purchases: [...sorted],
    dsNumbers,
    purchaseCount: sorted.length,
    totalAmount: sumMoney(sorted.map((purchase) => purchase.totalAmount)),
    amountPaid: sumMoney(sorted.map((purchase) => purchase.amountPaid)),
    balanceAmount: sumMoney(sorted.map((purchase) => purchase.balanceAmount)),
    quantities: quantitiesByCategory(sorted.flatMap((purchase) => purchase.items)),
    firstDate: sorted[sorted.length - 1].date,
    lastDate: sorted[0].date,
  }
}

/** Newest `YYYY-MM-DD` string first. */
function byDateDescending(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? 1 : -1
}

/**
 * Fold the purchase ledger into one summary per customer, most recently active
 * customer first. Empty input yields an empty list.
 */
export function groupPurchasesByCustomer(
  purchases: readonly Purchase[],
): CustomerSummary[] {
  const buckets = new Map<string, Purchase[]>()

  for (const purchase of purchases) {
    const bucket = buckets.get(purchase.nameKey)
    if (bucket) {
      bucket.push(purchase)
    } else {
      buckets.set(purchase.nameKey, [purchase])
    }
  }

  return [...buckets.values()]
    .map((group) => summarise(group[0].nameKey, [...group].sort(byNewest)))
    .sort((a, b) => byDateDescending(a.lastDate, b.lastDate))
}

/** The categories this customer actually bought, in the app's fixed order. */
export function purchasedCategories(quantities: Stock): Category[] {
  return CATEGORIES.filter((category) => quantities[category] > 0)
}

/** Free-text match over a customer's name, DS numbers and bought categories. */
export function customerMatches(customer: CustomerSummary, needle: string): boolean {
  const query = needle.trim().toLowerCase()
  if (!query) return true
  if (customer.key.includes(query)) return true
  if (customer.dsNumbers.some((dsNumber) => dsNumber.toLowerCase().includes(query))) return true
  return customer.purchases.some((purchase) =>
    purchase.items.some((item) => item.category.includes(query)),
  )
}