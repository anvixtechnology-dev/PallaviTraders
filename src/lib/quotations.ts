/**
 * Quotation rules and constants.
 *
 * A quotation is a commercial offer: quantity/weight priced at a rate per kg.
 * Nothing here touches stock. Pure functions, so the totals and validation can
 * be unit tested without React or Firestore.
 */

import type { Quotation, QuotationInput, QuotationItem, QuotationItemInput } from '@/types'
import { isValidDateKey } from './dates'
import { roundMoney, sumMoney } from './money'
import { amountInWords } from './words'

/** The shop's GSTIN, fixed and read-only. */
export const GSTIN = '37BPXPS5746G1ZY'

/** Fixed letterhead details printed on every quotation. */
export const BUSINESS = {
  name: 'PALLAVI IRON TRADERS',
  businessType: 'Sales & Purchase',
  materials: 'All Kinds of Pipes, Sheets, Hardware & Iron Materials',
  mobile: '99635 22888',
  proprietor: 'Merugu Srinivas',
  address:
    'D.No. 4-2-9A, Bypass Road, Near B.V. Raju Statue, BHIMAVARAM - 534 202, W.G. Dist., (A.P.)',
  gstin: GSTIN,
  gstNote: 'GST @ 18% extra as applicable.',
} as const

/** Line amount = weight (kg) x rate per kg. */
export function quotationItemAmount(item: QuotationItemInput): number {
  const weight = Number.isFinite(item.weightKg) ? item.weightKg : 0
  const rate = Number.isFinite(item.ratePerKg) ? item.ratePerKg : 0
  return roundMoney(weight * rate)
}

/** Sum of every line = the quotation grand total. */
export function quotationGrandTotal(items: readonly QuotationItemInput[]): number {
  return sumMoney(items.map((item) => quotationItemAmount(item)))
}

/** Build the stored quotation (line amounts + grand total + amount in words). */
export function buildQuotation(input: QuotationInput): Omit<Quotation, 'id' | 'createdAt'> {
  const items: QuotationItem[] = input.items.map((item) => ({
    description: item.description.trim(),
    size: item.size.trim(),
    quantity: item.quantity,
    thickness: item.thickness.trim(),
    weightKg: item.weightKg,
    ratePerKg: item.ratePerKg,
    amount: quotationItemAmount(item),
  }))

  const grandTotal = quotationGrandTotal(input.items)

  return {
    quotationNumber: input.quotationNumber.trim(),
    customerName: input.customerName.trim(),
    referenceNumber: input.referenceNumber.trim(),
    place: input.place.trim(),
    date: input.date,
    items,
    grandTotal,
    amountInWords: amountInWords(grandTotal),
  }
}

export type QuotationValidationResult =
  | { ok: true; data: QuotationInput }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

/**
 * Validate and normalise a quotation. Every line needs a description and a
 * non-negative weight and rate; the header needs a number, customer and date.
 */
export function validateQuotation(input: QuotationInput): QuotationValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!input.quotationNumber.trim()) fieldErrors.quotationNumber = 'Quotation number is required'
  if (!input.customerName.trim()) fieldErrors.customerName = 'Customer name is required'
  if (!isValidDateKey(input.date)) fieldErrors.date = 'Enter a valid date'

  const items = input.items
  if (items.length === 0) fieldErrors.items = 'Add at least one item'

  items.forEach((item, index) => {
    if (!item.description.trim()) {
      fieldErrors[`item.${index}.description`] = 'Description is required'
    }
    if (!Number.isFinite(item.weightKg) || item.weightKg <= 0) {
      fieldErrors[`item.${index}.weightKg`] = 'Enter a weight'
    }
    if (!Number.isFinite(item.ratePerKg) || item.ratePerKg < 0) {
      fieldErrors[`item.${index}.ratePerKg`] = 'Enter a rate'
    }
  })

  const firstError = Object.values(fieldErrors)[0]
  if (firstError) {
    return { ok: false, message: firstError, fieldErrors }
  }

  return {
    ok: true,
    data: {
      quotationNumber: input.quotationNumber.trim(),
      customerName: input.customerName.trim(),
      referenceNumber: input.referenceNumber.trim(),
      place: input.place.trim(),
      date: input.date,
      items: items.map((item) => ({
        description: item.description.trim(),
        size: item.size.trim(),
        quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
        thickness: item.thickness.trim(),
        weightKg: item.weightKg,
        ratePerKg: item.ratePerKg,
      })),
    },
  }
}

/** Pre-filled WhatsApp message: quotation number, customer name and grand total. */
export function quotationWhatsAppMessage(quotation: Quotation): string {
  return [
    `*${BUSINESS.name}*`,
    `Quotation No: ${quotation.quotationNumber}`,
    `Customer: ${quotation.customerName}`,
    `Grand Total: ₹${quotation.grandTotal}`,
    '',
    'Please find the quotation PDF attached.',
  ].join('\n')
}

/**
 * Build a `wa.me` link. A 10-digit Indian number is assumed to be missing its
 * country code and gets `91` prefixed.
 */
export function whatsAppUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
