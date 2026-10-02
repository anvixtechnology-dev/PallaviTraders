/**
 * Purchase form validation.
 *
 * Validation lives in the service layer as well as the form so that a record can
 * never reach Firestore with a bad grand total, a negative quantity or a payment
 * status that contradicts the amount paid.
 */

import { z } from 'zod'

import {
  CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PurchaseInput,
} from '@/types'
import { derivePaymentStatus, grandTotal, normaliseDsNumber } from './totals'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` that is also a real calendar date. */
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

/** Reject absurd precision such as 0.0001 which would corrupt the counters. */
function hasSanePrecision(value: number): boolean {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-9
}

const itemSchema = z.object({
  category: z.enum(CATEGORIES),
  quantity: z
    .number({ message: 'Enter a quantity' })
    .positive('Quantity must be more than 0')
    .refine(hasSanePrecision, 'Use at most 3 decimal places'),
  pricePerUnit: z
    .number({ message: 'Enter a price' })
    .min(0, 'Price cannot be negative'),
})

const schema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(80, 'Customer name is too long'),
  dsNumber: z
    .string()
    .trim()
    .min(1, 'DS number is required')
    .max(40, 'DS number is too long'),
  date: z
    .string()
    .refine(isRealDate, 'Enter a valid date'),
  items: z
    .array(itemSchema)
    .min(1, 'Select at least one item to sell')
    .refine(
      (items) => new Set(items.map((item) => item.category)).size === items.length,
      'Each item can only be added once',
    ),
  amountPaid: z
    .number({ message: 'Enter an amount' })
    .min(0, 'Amount paid cannot be negative'),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
})

export type ValidationResult =
  | { ok: true; data: PurchaseInput }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

/**
 * Validate and normalise a purchase. On success the returned data is safe to
 * persist: names are normalised for search and the payment status has been
 * checked against the amount paid.
 */
export function validatePurchase(input: PurchaseInput): ValidationResult {
  const result = schema.safeParse(input)

  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    let message = 'Please fix the highlighted fields.'

    for (const issue of result.error.issues) {
      // Zod issue paths may contain symbols; normalise them to string keys.
      const [head, index, field] = issue.path.map((part) =>
        typeof part === 'symbol' ? String(part) : part,
      )

      if (head === 'items' && typeof index === 'number' && field) {
        // Key item rows by category so the message lands on the right row.
        const category = input.items[index]?.category ?? index
        const key = `item.${category}.${field}`
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
        continue
      }

      // Array-level problems (no items, duplicate category) and plain field
      // problems both become the headline message.
      const key = head ?? 'form'
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message
        message = issue.message
      }
    }

    return { ok: false, message, fieldErrors }
  }

  const cleaned = result.data

  const expected = derivePaymentStatus(grandTotal(cleaned.items), cleaned.amountPaid)
  if (expected !== cleaned.paymentStatus) {
    const amountPaidField = 'amountPaid'
    return {
      ok: false,
      message:
        cleaned.paymentStatus === 'paid'
          ? 'Payment status is "Paid" but the amount paid does not cover the grand total.'
          : 'Payment status does not match the amount paid.',
      fieldErrors: { [amountPaidField]: 'This amount does not match the selected payment status.' },
    }
  }

  return {
    ok: true,
    data: {
      customerName: cleaned.customerName.trim(),
      dsNumber: normaliseDsNumber(cleaned.dsNumber),
      date: cleaned.date,
      items: cleaned.items.map((item) => ({
        category: item.category,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
      })),
      amountPaid: cleaned.amountPaid,
      paymentStatus: cleaned.paymentStatus,
      paymentMethod: cleaned.paymentMethod,
    },
  }
}
