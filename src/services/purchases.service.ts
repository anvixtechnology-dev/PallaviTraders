/**
 * Purchase service.
 *
 * A purchase document is both the customer record and the stock movement: the
 * form submits one customer entry with a DS number, so they are stored together.
 *
 * Saving runs inside a Firestore transaction so the stock counters can never end
 * up out of step with the saved purchase — either both are written or neither is.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import {
  CATEGORIES,
  type Category,
  type PaymentMethod,
  type PaymentStatus,
  type Purchase,
  type PurchaseInput,
  type PurchaseItem,
} from '@/types'
import { balanceFor, findShortfalls, grandTotal, nextStock, normaliseName, sanitiseStock } from '@/lib/totals'
import { InsufficientStockError, ValidationError, toErrorMessage } from '@/lib/errors'
import { validatePurchase } from '@/lib/validation'
import { roundMoney } from '@/lib/money'
import { db } from './firebase'
import { STOCK_DOC_ID } from './stock.service'

const purchasesRef = collection(db, 'purchases')

export type PurchasesListener = (purchases: Purchase[], loaded: boolean) => void

/**
 * Live subscription to every saved purchase, newest first. Records are never
 * deleted by the app, so this is the permanent customer ledger.
 */
export function subscribePurchases(
  onChange: PurchasesListener,
  onError?: (message: string) => void,
): Unsubscribe {
  const q = query(purchasesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const purchases = snapshot.docs
        .map((snap) => toPurchase(snap))
        .filter((purchase): purchase is Purchase => purchase !== null)
      onChange(purchases, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load customer records.'))
    },
  )
}

export interface SaveResult {
  purchase: Purchase
  stockAfter: ReturnType<typeof nextStock>
}

/**
 * Validate, then atomically save the purchase and reduce stock.
 *
 * Throws `ValidationError` for bad input and `InsufficientStockError` when the
 * shop does not have enough on hand.
 */
export async function createPurchase(input: PurchaseInput): Promise<SaveResult> {
  const validation = validatePurchase(input)
  if (!validation.ok) {
    throw new ValidationError(validation.message, validation.fieldErrors)
  }

  const { data } = validation
  const totalAmount = grandTotal(data.items)
  const balanceAmount = balanceFor(totalAmount, data.amountPaid)

  const items: PurchaseItem[] = data.items.map((item) => ({
    category: item.category,
    quantity: item.quantity,
    pricePerUnit: item.pricePerUnit,
    total: roundMoney(item.quantity * item.pricePerUnit),
  }))

  const purchaseRef = doc(purchasesRef)
  const createdAt = Date.now()

  const purchase: Purchase = {
    id: purchaseRef.id,
    customerName: data.customerName,
    nameKey: normaliseName(data.customerName),
    dsNumber: data.dsNumber,
    date: data.date,
    items,
    totalAmount,
    amountPaid: roundMoney(data.amountPaid),
    balanceAmount,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    createdAt,
  }

  const stockAfter = await runTransaction(db, async (transaction) => {
    const stockRef = doc(db, 'stock', STOCK_DOC_ID)
    const snapshot = await transaction.get(stockRef)
    const current = snapshot.exists() ? sanitiseStock(snapshot.data()) : sanitiseStock(null)

    // Re-check availability inside the transaction: another admin may have sold
    // the same pipes since the form was opened.
    const shortfalls = findShortfalls(current, data.items)
    if (shortfalls.length > 0) throw new InsufficientStockError(shortfalls)

    const remaining = nextStock(current, data.items)

    transaction.set(stockRef, { ...remaining, updatedAt: createdAt }, { merge: true })
    transaction.set(purchaseRef, purchase)

    return remaining
  })

  return { purchase, stockAfter }
}

/** Convert a snapshot into a `Purchase`, skipping anything malformed. */
function toPurchase(snapshot: QueryDocumentSnapshot<DocumentData>): Purchase | null {
  const data = snapshot.data()
  if (!data || typeof data.customerName !== 'string' || !Array.isArray(data.items)) return null

  const items = data.items
    .filter(isRecord)
    .filter((item) => isCategory(item.category))
    .map((item) => ({
      category: item.category as Category,
      quantity: numberOrZero(item.quantity),
      pricePerUnit: numberOrZero(item.pricePerUnit),
      total: numberOrZero(item.total),
    }))

  if (items.length === 0) return null

  return {
    id: snapshot.id,
    customerName: data.customerName,
    nameKey:
      typeof data.nameKey === 'string' ? data.nameKey : normaliseName(data.customerName),
    dsNumber: typeof data.dsNumber === 'string' ? data.dsNumber : '',
    date: typeof data.date === 'string' ? data.date : '',
    items,
    totalAmount: numberOrZero(data.totalAmount),
    amountPaid: numberOrZero(data.amountPaid),
    balanceAmount: numberOrZero(data.balanceAmount),
    paymentStatus: asPaymentStatus(data.paymentStatus),
    paymentMethod: asPaymentMethod(data.paymentMethod),
    createdAt: numberOrZero(data.createdAt),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asPaymentStatus(value: unknown): PaymentStatus {
  return value === 'paid' || value === 'partial' || value === 'unpaid' ? value : 'unpaid'
}

function asPaymentMethod(value: unknown): PaymentMethod {
  return typeof value === 'string' ? (value as PaymentMethod) : 'cash'
}
