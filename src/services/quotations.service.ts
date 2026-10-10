/**
 * Quotation service.
 *
 * Quotations are commercial offers and never touch stock. They are stored in
 * the `quotations` collection for record-keeping and to suggest the next number.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'

import type { Quotation, QuotationInput } from '@/types'
import { buildQuotation, validateQuotation } from '@/lib/quotations'
import { ValidationError, toErrorMessage } from '@/lib/errors'
import { db } from './firebase'

const quotationsRef = collection(db, 'quotations')

export type QuotationsListener = (quotations: Quotation[], loaded: boolean) => void

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
        .map((snap) => {
          const data = snap.data()
          return { ...(data as Omit<Quotation, 'id'>), id: snap.id }
        })
        .filter((quotation) => typeof quotation.quotationNumber === 'string')
      onChange(quotations, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load quotations.'))
    },
  )
}

/** Validate, then save the quotation. */
export async function createQuotation(input: QuotationInput): Promise<Quotation> {
  const validation = validateQuotation(input)
  if (!validation.ok) {
    throw new ValidationError(validation.message, validation.fieldErrors)
  }

  const quotationRef = doc(quotationsRef)
  const quotation: Quotation = {
    id: quotationRef.id,
    ...buildQuotation(validation.data),
    createdAt: Date.now(),
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
