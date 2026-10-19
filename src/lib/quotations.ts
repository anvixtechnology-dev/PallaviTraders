/**
 * Quotation rules, constants and calculations.
 *
 * A quotation is a commercial offer: pipes and sheets are priced by weight
 * (kg), hardware either by the piece or (for plates) by weight. Nothing here
 * touches stock. Everything is a pure function, so the totals and validation
 * can be unit tested without React or Firestore.
 */

import type {
  HardwareItemInput,
  PieceHardwareItem,
  PieceHardwareItemInput,
  PipeItem,
  PipeItemInput,
  PlateHardwareItem,
  PlateHardwareItemInput,
  Quotation,
  QuotationInput,
  QuotationItem,
  QuotationItemInput,
  QuotationTotals,
  SheetItem,
  SheetItemInput,
} from '@/types'
import { ITEM_CATEGORY_LABELS, PIPE_TYPE_LABELS } from '@/types'
import { isValidDateKey } from './dates'
import { formatNumber, roundMoney, sumMoney } from './money'
import { amountInWords } from './words'

/** The shop's GSTIN, fixed and read-only. Never replaced by a customer GST. */
export const GSTIN = '37BPXPS5746G1ZY'

/** Fixed letterhead details printed on every quotation. */
export const BUSINESS = {
  name: 'PALLAVI IRON TRADERS',
  businessType: 'Whole Sale, Retail',
  materials:
    'G.I., M.S. Pipes • Roofing Sheets • Tata Reveting Sheets • Iron Scrap • All Types of Iron Materials',
  mobile: '99635 22888 / 9705012208',
  proprietors: 'Merugu Srinivas / Vaida Satish',
  address:
    'D.No. 4-2-9A, Bypass Road, Near B.V. Raju Statue, BHIMAVARAM - 534 202, W.G. Dist., (A.P.)',
  gstin: GSTIN,
} as const

/* ------------------------------------------------------------------ *
 * Reference tables                                                    *
 * ------------------------------------------------------------------ */

export interface RoundPipeSize {
  /** Nominal size shown to the user, e.g. `1/2"`. */
  nominal: string
  /** Outer diameter in mm, auto-filled when the size is chosen. */
  odMm: number
  minWallMm: number
  maxWallMm: number
}

/** Round pipe nominal sizes with the OD and wall-thickness range. */
export const ROUND_PIPE_SIZES: readonly RoundPipeSize[] = [
  { nominal: '1/2"', odMm: 20, minWallMm: 0.8, maxWallMm: 2.1 },
  { nominal: '3/4"', odMm: 25, minWallMm: 0.8, maxWallMm: 2.2 },
  { nominal: '1"', odMm: 32, minWallMm: 0.9, maxWallMm: 2.2 },
  { nominal: '1 1/4"', odMm: 40, minWallMm: 0.8, maxWallMm: 2.3 },
  { nominal: '1 1/2"', odMm: 47, minWallMm: 1.0, maxWallMm: 2.3 },
  { nominal: '2"', odMm: 59, minWallMm: 0.9, maxWallMm: 2.0 },
  { nominal: '2 1/2"', odMm: 75, minWallMm: 1.1, maxWallMm: 2.0 },
  { nominal: '3"', odMm: 88, minWallMm: 1.0, maxWallMm: 2.2 },
  { nominal: '4"', odMm: 114, minWallMm: 1.0, maxWallMm: 2.2 },
  { nominal: '5"', odMm: 140, minWallMm: 1.1, maxWallMm: 2.5 },
  { nominal: '6"', odMm: 165, minWallMm: 1.2, maxWallMm: 2.7 },
  { nominal: '8"', odMm: 219, minWallMm: 1.4, maxWallMm: 2.4 },
] as const

/** Box pipe dimensions. */
export const BOX_PIPE_SIZES = [
  '20 × 20 mm',
  '25 × 25 mm',
  '40 × 20 mm',
  '40 × 40 mm',
  '50 × 25 mm',
  '50 × 50 mm',
  '60 × 40 mm',
  '75 × 50 mm',
  '80 × 40 mm',
  '100 × 50 mm',
  '100 × 100 mm',
] as const

/** Sheet lengths: 2 ft to 30 ft in 0.5 ft steps. */
export const SHEET_LENGTHS: readonly number[] = (() => {
  const values: number[] = []
  for (let value = 2; value <= 30; value += 0.5) values.push(Number(value.toFixed(1)))
  return values
})()

/** Find the round pipe row for a nominal size, if it is a known size. */
export function findRoundPipeSize(nominal: string): RoundPipeSize | undefined {
  return ROUND_PIPE_SIZES.find((size) => size.nominal === nominal)
}

/* ------------------------------------------------------------------ *
 * Customer GST number                                                 *
 * ------------------------------------------------------------------ */

/** Customer GST numbers are optional and alphanumeric only. */
export const CUSTOMER_GST_PATTERN = /^[A-Za-z0-9]+$/

/** Normalise a customer GST number: trim, and drop anything non-alphanumeric. */
export function normaliseCustomerGst(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '')
}

/* ------------------------------------------------------------------ *
 * Calculations                                                        *
 * ------------------------------------------------------------------ */

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Total weight of a pipe line: weight per pipe x quantity. */
export function pipeTotalWeight(item: PipeItemInput): number {
  const weight = Number.isFinite(item.weightPerPipeKg) ? item.weightPerPipeKg : 0
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
  return round(weight * quantity)
}

/** Pipe line amount: total weight x rate per kg. */
export function pipeAmount(item: PipeItemInput): number {
  const rate = Number.isFinite(item.ratePerKg) ? item.ratePerKg : 0
  return roundMoney(pipeTotalWeight(item) * rate)
}

/** Sheet line total weight: length (ft) x weight per foot x quantity. */
export function sheetTotalWeight(item: SheetItemInput): number {
  const length = Number.isFinite(item.lengthFt) ? item.lengthFt : 0
  const perFoot = Number.isFinite(item.weightPerFootKg) ? item.weightPerFootKg : 0
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
  return round(length * perFoot * quantity)
}

/** Sheet line amount: total weight x rate per kg. */
export function sheetAmount(item: SheetItemInput): number {
  const rate = Number.isFinite(item.ratePerKg) ? item.ratePerKg : 0
  return roundMoney(sheetTotalWeight(item) * rate)
}

/** Piece-based hardware line amount: pieces x rate per piece. */
export function pieceHardwareAmount(item: PieceHardwareItemInput): number {
  const pieces = Number.isFinite(item.pieces) ? item.pieces : 0
  const rate = Number.isFinite(item.ratePerPiece) ? item.ratePerPiece : 0
  return roundMoney(pieces * rate)
}

/** Plate-based hardware line amount: weight (kg) x rate per kg. */
export function plateHardwareAmount(item: PlateHardwareItemInput): number {
  const weight = Number.isFinite(item.weightKg) ? item.weightKg : 0
  const rate = Number.isFinite(item.ratePerKg) ? item.ratePerKg : 0
  return roundMoney(weight * rate)
}

/** Hardware line amount, priced per piece or per kg depending on the type. */
export function hardwareAmount(item: HardwareItemInput): number {
  return item.hardwareType === 'plate'
    ? plateHardwareAmount(item)
    : pieceHardwareAmount(item)
}

/** Total weight in kg for any line (plate hardware weighs; piece hardware has none). */
export function quotationItemWeight(item: QuotationItemInput): number {
  switch (item.category) {
    case 'pipes':
      return pipeTotalWeight(item)
    case 'sheets':
      return sheetTotalWeight(item)
    case 'hardware':
      return item.hardwareType === 'plate' && Number.isFinite(item.weightKg)
        ? round(item.weightKg)
        : 0
  }
}

/** Amount for any line. */
export function quotationItemAmount(item: QuotationItemInput): number {
  switch (item.category) {
    case 'pipes':
      return pipeAmount(item)
    case 'sheets':
      return sheetAmount(item)
    case 'hardware':
      return hardwareAmount(item)
  }
}

/** Category subtotals and the grand total from every line. */
export function computeTotals(items: readonly QuotationItemInput[]): QuotationTotals {
  const pipesTotal = sumMoney(
    items.filter((item) => item.category === 'pipes').map((item) => quotationItemAmount(item)),
  )
  const sheetsTotal = sumMoney(
    items.filter((item) => item.category === 'sheets').map((item) => quotationItemAmount(item)),
  )
  const hardwareTotal = sumMoney(
    items.filter((item) => item.category === 'hardware').map((item) => quotationItemAmount(item)),
  )
  return {
    pipesTotal,
    sheetsTotal,
    hardwareTotal,
    grandTotal: sumMoney([pipesTotal, sheetsTotal, hardwareTotal]),
  }
}

/** Old alias kept for callers that only need the grand total. */
export function quotationGrandTotal(items: readonly QuotationItemInput[]): number {
  return computeTotals(items).grandTotal
}

/* ------------------------------------------------------------------ *
 * Building a stored quotation                                         *
 * ------------------------------------------------------------------ */

function toStoredItem(item: QuotationItemInput): QuotationItem {
  switch (item.category) {
    case 'pipes': {
      const stored: PipeItem = {
        ...item,
        size: item.size.trim(),
        totalWeightKg: pipeTotalWeight(item),
        amount: pipeAmount(item),
      }
      return stored
    }
    case 'sheets': {
      const stored: SheetItem = {
        ...item,
        totalWeightKg: sheetTotalWeight(item),
        amount: sheetAmount(item),
      }
      return stored
    }
    case 'hardware': {
      const description = item.description.trim()
      if (item.hardwareType === 'plate') {
        const stored: PlateHardwareItem = { ...item, description, amount: plateHardwareAmount(item) }
        return stored
      }
      const stored: PieceHardwareItem = { ...item, description, amount: pieceHardwareAmount(item) }
      return stored
    }
  }
}

/** Build the stored quotation (line amounts, totals, amount in words). */
export function buildQuotation(
  input: QuotationInput,
): Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'> {
  const items = input.items.map(toStoredItem)
  const totals = computeTotals(items)

  return {
    quotationNumber: input.quotationNumber.trim(),
    customerName: input.customerName.trim(),
    customerGstNumber: normaliseCustomerGst(input.customerGstNumber),
    referenceNumber: input.referenceNumber.trim(),
    place: input.place.trim(),
    date: input.date,
    items,
    ...totals,
    amountInWords: amountInWords(totals.grandTotal),
  }
}

/* ------------------------------------------------------------------ *
 * Unified quotation table                                             *
 * ------------------------------------------------------------------ */

/**
 * A long-ish dash shown in table cells that do not apply to an item, e.g. the
 * length of a pipe or the size of a hardware item.
 */
export const EMPTY_CELL = '\u2014'

/**
 * Flatten a quotation's items into a single table, in the order they were
 * entered. Every row has the same nine cells, matching the shared header used
 * by both the preview/print view and the PDF:
 *
 * `S.No | Category | Item / Type | Size | Length (Ft) | Weight (Kg) | Qty / Pieces | Rate | Amount`
 *
 * Cells that do not apply to a category are filled with {@link EMPTY_CELL}.
 */
export function quotationTableRows(quotation: Quotation): string[][] {
  return quotation.items.map((item, index) => {
    const row = [
      String(index + 1),
      ITEM_CATEGORY_LABELS[item.category],
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      EMPTY_CELL,
      formatNumber(item.amount),
    ]

    switch (item.category) {
      case 'pipes':
        row[2] = PIPE_TYPE_LABELS[item.pipeType]
        row[3] = item.size || EMPTY_CELL
        row[5] = formatNumber(item.totalWeightKg)
        row[6] = formatNumber(item.quantity, 0)
        row[7] = formatNumber(item.ratePerKg)
        break
      case 'sheets':
        row[2] = 'Sheets'
        row[4] = formatNumber(item.lengthFt, 1)
        row[5] = formatNumber(item.totalWeightKg)
        row[6] = formatNumber(item.quantity, 0)
        row[7] = formatNumber(item.ratePerKg)
        break
      case 'hardware':
        row[2] = item.description || EMPTY_CELL
        if (item.hardwareType === 'plate') {
          row[5] = formatNumber(item.weightKg)
          row[7] = formatNumber(item.ratePerKg)
        } else {
          row[6] = formatNumber(item.pieces, 0)
          row[7] = formatNumber(item.ratePerPiece)
        }
        break
    }

    return row
  })
}

/* ------------------------------------------------------------------ *
 * Validation                                                          *
 * ------------------------------------------------------------------ */

export type QuotationValidationResult =
  | { ok: true; data: QuotationInput }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

function numberFieldError(
  value: number,
  { required = true }: { required?: boolean } = {},
): string | null {
  if (!Number.isFinite(value)) return 'Enter a valid number'
  if (value < 0) return 'Cannot be negative'
  if (required && value <= 0) return 'Required'
  return null
}

/**
 * Validate and normalise a quotation. Header fields are required; each line is
 * validated against its own category.
 */
export function validateQuotation(input: QuotationInput): QuotationValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!input.quotationNumber.trim()) fieldErrors.quotationNumber = 'Quotation number is required'
  if (!input.customerName.trim()) fieldErrors.customerName = 'Customer name is required'

  const customerGst = input.customerGstNumber.trim()
  if (customerGst && !CUSTOMER_GST_PATTERN.test(customerGst)) {
    fieldErrors.customerGstNumber = 'Use letters and numbers only'
  }

  if (!isValidDateKey(input.date)) fieldErrors.date = 'Enter a valid date'

  if (input.items.length === 0) fieldErrors.items = 'Add at least one item'

  input.items.forEach((item, index) => {
    const key = (field: string) => `item.${index}.${field}`

    if (item.category === 'pipes') {
      // Size is required for both pipe types.
      if (!item.size.trim()) fieldErrors[key('size')] = 'Select a size'

      const weightError = numberFieldError(item.weightPerPipeKg)
      if (weightError) fieldErrors[key('weightPerPipeKg')] = weightError

      const qtyError = numberFieldError(item.quantity)
      if (qtyError) fieldErrors[key('quantity')] = qtyError

      const rateError = numberFieldError(item.ratePerKg, { required: false })
      if (rateError) fieldErrors[key('ratePerKg')] = rateError
    }

    if (item.category === 'sheets') {
      const lengthError = numberFieldError(item.lengthFt)
      if (lengthError) fieldErrors[key('lengthFt')] = lengthError

      const perFootError = numberFieldError(item.weightPerFootKg)
      if (perFootError) fieldErrors[key('weightPerFootKg')] = perFootError

      const qtyError = numberFieldError(item.quantity)
      if (qtyError) fieldErrors[key('quantity')] = qtyError

      const rateError = numberFieldError(item.ratePerKg, { required: false })
      if (rateError) fieldErrors[key('ratePerKg')] = rateError
    }

    if (item.category === 'hardware') {
      if (!item.description.trim()) fieldErrors[key('description')] = 'Description is required'

      if (item.hardwareType === 'plate') {
        const weightError = numberFieldError(item.weightKg)
        if (weightError) fieldErrors[key('weightKg')] = weightError

        const rateError = numberFieldError(item.ratePerKg, { required: false })
        if (rateError) fieldErrors[key('ratePerKg')] = rateError
      } else {
        const piecesError = numberFieldError(item.pieces)
        if (piecesError) fieldErrors[key('pieces')] = piecesError

        const rateError = numberFieldError(item.ratePerPiece, { required: false })
        if (rateError) fieldErrors[key('ratePerPiece')] = rateError
      }
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
      customerGstNumber: normaliseCustomerGst(customerGst),
      referenceNumber: input.referenceNumber.trim(),
      place: input.place.trim(),
      date: input.date,
      items: input.items.map((item) => {
        if (item.category === 'pipes') {
          return { ...item, size: item.size.trim() }
        }
        if (item.category === 'hardware') {
          return { ...item, description: item.description.trim() }
        }
        return item
      }),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Notes, WhatsApp                                                      *
 * ------------------------------------------------------------------ */

/** The GST note printed under the tables. Rates are GST-inclusive. */
export const GST_NOTE = 'Rates are inclusive of CGST 9% + SGST 9%.'

/** Pre-filled WhatsApp message: business, number, customer and grand total. */
export function quotationWhatsAppMessage(quotation: Quotation): string {
  return [
    `*${BUSINESS.name}*`,
    '',
    'Please find your quotation.',
    `Quotation No: ${quotation.quotationNumber}`,
    `Customer: ${quotation.customerName}`,
    `Grand Total: ₹${formatNumber(quotation.grandTotal)}`,
    '',
    'Thank you for your business.',
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

/** A safe filename for the downloaded or shared quotation PDF. */
export function quotationPdfFileName(quotation: Pick<Quotation, 'quotationNumber'>): string {
  const safe = quotation.quotationNumber
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `Quotation-${safe || 'draft'}.pdf`
}
