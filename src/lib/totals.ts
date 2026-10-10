/**
 * Pure business rules.
 *
 * Everything the app calculates — line totals, grand total, payment status and
 * the balance — lives here as plain functions so it can be unit tested without
 * React or Firestore.
 */

import type { PaymentStatus } from '@/types'
import { fromCents, multiplyMoney, sumMoney, toCents } from './money'

/** Anything that has a quantity and a unit price (a sale line). */
export interface PricedLine {
  quantity: number
  pricePerUnit: number
}

/** Normalise a customer name for searching: trimmed, collapsed, lowercase. */
export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Normalise a DS number for display: internal whitespace removed. */
export function normaliseDsNumber(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

/** Quantity x price per unit. */
export function itemTotal(quantity: number, pricePerUnit: number): number {
  return multiplyMoney(quantity, pricePerUnit)
}

/** Sum of every selected line = the grand total. */
export function grandTotal(items: readonly { quantity: number; pricePerUnit: number }[]): number {
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
