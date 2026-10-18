/**
 * Customer helpers.
 *
 * Sales are stored one document per transaction, so the Customers screen groups
 * them by customer (the normalised `nameKey`) so every customer is a single row
 * with their purchases folded into one set of totals. Plain functions, no React
 * and no Firestore, so they are unit testable.
 */

import type { PaymentStatus, Sale } from '@/types'
import { roundMoney } from './money'
import { derivePaymentStatus } from './totals'

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

/** One customer with every sale they made folded into running totals. */
export interface CustomerGroup {
  nameKey: string
  name: string
  sales: Sale[]
  saleCount: number
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  paymentStatus: PaymentStatus
  /** Most recent sale date across the group, `YYYY-MM-DD`. */
  lastDate: string
}

/**
 * Group sales by customer, keeping the order they arrive in. Sales are fetched
 * newest first, so each group appears in order of its most recent purchase and
 * its `sales` array is newest first too. The payment status is re-derived from
 * the group's own total and amount paid, so a customer who paid off earlier
 * balances can show as `Paid` even when an individual sale was not.
 */
export function groupSalesByCustomer(sales: readonly Sale[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>()

  for (const sale of sales) {
    const existing = groups.get(sale.nameKey)
    if (existing) {
      existing.sales.push(sale)
      existing.saleCount += 1
      existing.totalAmount = roundMoney(existing.totalAmount + sale.totalAmount)
      existing.amountPaid = roundMoney(existing.amountPaid + sale.amountPaid)
      existing.balanceAmount = roundMoney(existing.balanceAmount + sale.balanceAmount)
      if (sale.date > existing.lastDate) existing.lastDate = sale.date
    } else {
      groups.set(sale.nameKey, {
        nameKey: sale.nameKey,
        name: sale.customerName,
        sales: [sale],
        saleCount: 1,
        totalAmount: roundMoney(sale.totalAmount),
        amountPaid: roundMoney(sale.amountPaid),
        balanceAmount: roundMoney(sale.balanceAmount),
        paymentStatus: 'unpaid',
        lastDate: sale.date,
      })
    }
  }

  const result = [...groups.values()]
  for (const group of result) {
    group.paymentStatus = derivePaymentStatus(group.totalAmount, group.amountPaid)
  }
  return result
}
