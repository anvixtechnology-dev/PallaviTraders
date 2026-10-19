/**
 * Quotation service.
 *
 * Quotations are commercial offers and never touch stock. They are stored in
 * the `quotations` collection for record-keeping and to suggest the next number.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'

import type {
  ItemCategory,
  PieceHardwareItem,
  PipeItem,
  PlateHardwareItem,
  Quotation,
  QuotationInput,
  QuotationItem,
} from '@/types'
import { buildQuotation, computeTotals, validateQuotation } from '@/lib/quotations'
import { AppError, ValidationError, toErrorMessage } from '@/lib/errors'
import { db } from './firebase'

const quotationsRef = collection(db, 'quotations')

export type QuotationsListener = (quotations: Quotation[], loaded: boolean) => void

const CATEGORIES: readonly ItemCategory[] = ['pipes', 'sheets', 'hardware']

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Older quotations stored a flat pipe-like line (`weightKg`, `thickness`
 * string). Map anything without a valid `category` onto a round pipe so saved
 * records keep opening.
 *
 * Hardware lines written before the Hardware Type feature have no
 * `hardwareType`; they are restored as piece-based ("None") hardware.
 */
function normaliseStoredItem(raw: unknown): QuotationItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Record<string, unknown>
  const category = item.category

  if (typeof category === 'string' && CATEGORIES.includes(category as ItemCategory)) {
    // Older sheet lines had no quantity (weight was entered manually or as
    // length x weight per foot); default it so saved records keep opening.
    if (category === 'sheets') {
      return {
        ...(item as unknown as QuotationItem),
        quantity: toNumber(item.quantity) || 1,
      } as QuotationItem
    }
    if (category === 'hardware') {
      if (item.hardwareType === 'plate') {
        const plate: PlateHardwareItem = {
          category: 'hardware',
          hardwareType: 'plate',
          description: toText(item.description),
          weightKg: toNumber(item.weightKg),
          ratePerKg: toNumber(item.ratePerKg),
          amount: toNumber(item.amount),
        }
        return plate
      }
      const piece: PieceHardwareItem = {
        category: 'hardware',
        hardwareType: 'none',
        description: toText(item.description),
        pieces: toNumber(item.pieces),
        ratePerPiece: toNumber(item.ratePerPiece),
        amount: toNumber(item.amount),
      }
      return piece
    }
    return raw as QuotationItem
  }

  // Legacy shape.
  if ('weightKg' in item || 'ratePerKg' in item) {
    const quantity = toNumber(item.quantity)
    const weightKg = toNumber(item.weightKg)
    const legacy: PipeItem = {
      category: 'pipes',
      pipeType: 'round',
      size: toText(item.size),
      weightPerPipeKg: quantity > 0 ? weightKg / quantity : weightKg,
      quantity,
      ratePerKg: toNumber(item.ratePerKg),
      totalWeightKg: weightKg,
      amount: toNumber(item.amount),
    }
    return legacy
  }

  return null
}

/** Rebuild a stored quotation from Firestore data, tolerating legacy records. */
function normaliseQuotation(id: string, raw: unknown): Quotation | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Record<string, unknown>
  if (typeof data.quotationNumber !== 'string') return null

  const items = Array.isArray(data.items)
    ? data.items.map(normaliseStoredItem).filter((item): item is QuotationItem => item !== null)
    : []

  const totals = computeTotals(items)
  const storedPipes = toNumber(data.pipesTotal)
  const storedSheets = toNumber(data.sheetsTotal)
  const storedHardware = toNumber(data.hardwareTotal)
  const storedGrand = toNumber(data.grandTotal)
  const hasStoredTotals =
    data.pipesTotal !== undefined ||
    data.sheetsTotal !== undefined ||
    data.hardwareTotal !== undefined

  return {
    id,
    quotationNumber: data.quotationNumber,
    customerName: toText(data.customerName),
    customerGstNumber: toText(data.customerGstNumber),
    referenceNumber: toText(data.referenceNumber),
    place: toText(data.place),
    date: toText(data.date),
    items,
    pipesTotal: hasStoredTotals ? storedPipes : totals.pipesTotal,
    sheetsTotal: hasStoredTotals ? storedSheets : totals.sheetsTotal,
    hardwareTotal: hasStoredTotals ? storedHardware : totals.hardwareTotal,
    grandTotal: Number.isFinite(storedGrand) && storedGrand > 0 ? storedGrand : totals.grandTotal,
    amountInWords: toText(data.amountInWords),
    createdAt: toNumber(data.createdAt),
    updatedAt: toNumber(data.updatedAt) || toNumber(data.createdAt),
  }
}

/** Live subscription to every quotation, newest first. */
export function subscribeQuotations(
  onChange: QuotationsListener,
  onError?: (message: string) => void,
): Unsubscribe {
  const q = query(quotationsRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const quotations = snapshot.docs
        .map((snap) => normaliseQuotation(snap.id, snap.data()))
        .filter((quotation): quotation is Quotation => quotation !== null)
      onChange(quotations, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load quotations.'))
    },
  )
}

/** Validate, then save the quotation as a new document. */
export async function createQuotation(input: QuotationInput): Promise<Quotation> {
  const validation = validateQuotation(input)
  if (!validation.ok) {
    throw new ValidationError(validation.message, validation.fieldErrors)
  }

  const quotationRef = doc(quotationsRef)
  const now = Date.now()
  const quotation: Quotation = {
    id: quotationRef.id,
    ...buildQuotation(validation.data),
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(quotationRef, quotation)
  return quotation
}

/** Suggest the next number, e.g. `PIT/0007`, from the highest already used. */
export function suggestQuotationNumber(quotations: readonly Quotation[]): string {
  const highest = quotations.reduce((max, quotation) => {
    const match = /(\d+)\s*$/.exec(quotation.quotationNumber)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `PIT/${String(highest + 1).padStart(4, '0')}`
}

/** Load a saved quotation by document id, or throw if it no longer exists. */
async function requireStoredQuotation(id: string): Promise<Quotation> {
  const snapshot = await getDoc(doc(quotationsRef, id))
  if (!snapshot.exists()) {
    throw new AppError(
      'This quotation no longer exists. It may have been deleted in another session.',
    )
  }
  const quotation = normaliseQuotation(snapshot.id, snapshot.data())
  if (!quotation) throw new AppError('This quotation could not be read.')
  return quotation
}

/**
 * Reject a quotation number already used by a *different* document. The check
 * reads the collection (the same way the list and number suggestion do), so no
 * extra Firestore index is needed.
 */
async function assertQuotationNumberFree(number: string, excludeId: string): Promise<void> {
  const snapshot = await getDocs(quotationsRef)
  const taken = snapshot.docs.some(
    (snap) => snap.id !== excludeId && toText(snap.data().quotationNumber).trim() === number,
  )
  if (taken) {
    throw new ValidationError('Quotation number is already used.', {
      quotationNumber: `Quotation ${number} already exists. Use a different number.`,
    })
  }
}

/**
 * Update an existing quotation in place. The document keeps its original id and
 * `createdAt`; only the saved fields and `updatedAt` change. Validation and
 * quotation-number uniqueness run exactly as they do when creating.
 */
export async function updateQuotation(id: string, input: QuotationInput): Promise<Quotation> {
  const validation = validateQuotation(input)
  if (!validation.ok) {
    throw new ValidationError(validation.message, validation.fieldErrors)
  }

  const existing = await requireStoredQuotation(id)
  await assertQuotationNumberFree(validation.data.quotationNumber.trim(), id)

  const now = Date.now()
  const built = buildQuotation(validation.data)

  // `updateDoc` touches only the listed fields, so `createdAt` is preserved.
  await updateDoc(doc(quotationsRef, id), { ...built, id, updatedAt: now })

  return { id, ...built, createdAt: existing.createdAt, updatedAt: now }
}

/** Permanently delete a quotation document from Firestore. */
export async function deleteQuotation(id: string): Promise<void> {
  await deleteDoc(doc(quotationsRef, id))
}
