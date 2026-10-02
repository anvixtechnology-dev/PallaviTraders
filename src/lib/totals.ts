/**
 * Pure business rules.
 *
 * Everything the app calculates — line totals, grand total, payment status,
 * balance and the stock left after a sale — lives here as plain functions so it
 * can be unit tested without React or Firestore.
 */

import { CATEGORIES, type Category, type PaymentStatus, type Stock, type StockShortfall } from '@/types'
import type { PurchaseItemInput } from '@/types'
import { fromCents, multiplyMoney, roundMoney, sumMoney, toCents } from './money'

/** Normalise a customer name for searching: trimmed, collapsed, lowercase. */
export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Normalise a DS number for display: internal whitespace removed. */
export function normaliseDsNumber(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

/** Quantity x price per item. */
export function itemTotal(quantity: number, pricePerUnit: number): number {
  return multiplyMoney(quantity, pricePerUnit)
}

/** Sum of every selected line = the grand total. */
export function grandTotal(items: readonly PurchaseItemInput[]): number {
  return sumMoney(items.map((item) => itemTotal(item.quantity, item.pricePerUnit)))
}

/** Remaining balance = grand total - amount paid, never negative. */
export function balanceFor(totalAmount: number, amountPaid: number): number {
  return Math.max(0, fromCents(toCents(totalAmount) - toCents(amountPaid)))
}

/**
 * Payment status implied by the amount paid:
 * fully covered -> paid, something covered -> partial, nothing -> unpaid.
 */
export function derivePaymentStatus(totalAmount: number, amountPaid: number): PaymentStatus {
  const total = toCents(totalAmount)
  const paid = toCents(amountPaid)
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

/** Add up the quantities per category across all selected lines. */
export function quantitiesByCategory(items: readonly PurchaseItemInput[]): Stock {
  const totals: Stock = { pipes: 0, sheets: 0, hardware: 0 }
  for (const item of items) {
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
    if (quantity === 0) continue
    totals[item.category] = roundMoney(totals[item.category] + quantity)
  }
  return totals
}

/**
 * Categories where the requested quantity is greater than what is on hand.
 * Categories with no requested quantity are never a shortfall.
 */
export function findShortfalls(
  stock: Stock,
  items: readonly PurchaseItemInput[],
): StockShortfall[] {
  const requested = quantitiesByCategory(items)
  const shortfalls: StockShortfall[] = []
  for (const category of CATEGORIES) {
    if (requested[category] > 0 && requested[category] > stock[category]) {
      shortfalls.push({ category, requested: requested[category], available: stock[category] })
    }
  }
  return shortfalls
}

/** Stock remaining after a purchase: current stock minus everything sold. */
export function nextStock(stock: Stock, items: readonly PurchaseItemInput[]): Stock {
  const sold = quantitiesByCategory(items)
  const result: Stock = { pipes: 0, sheets: 0, hardware: 0 }
  for (const category of CATEGORIES) {
    result[category] = Math.max(0, roundMoney(stock[category] - sold[category]))
  }
  return result
}

/** Coerce anything read from Firestore into a valid, non-negative stock value. */
export function sanitiseStock(raw: unknown): Stock {
  const source = (raw ?? {}) as Partial<Record<Category, unknown>>
  const result: Stock = { pipes: 0, sheets: 0, hardware: 0 }
  for (const category of CATEGORIES) {
    const value = source[category]
    result[category] = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
  }
  return result
}

export const EMPTY_STOCK: Stock = { pipes: 0, sheets: 0, hardware: 0 }
