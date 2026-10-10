/**
 * Sales service.
 *
 * A sale is both the customer transaction and the stock movement. Saving runs
 * inside a Firestore transaction: the stock documents are read, checked and
 * decremented, the sale is written, and the customer's aggregate record in the
 * `customers` collection is updated — all or nothing.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import type {
  CustomerRecord,
  PaymentMethod,
  PaymentStatus,
  Sale,
  SaleInput,
  SaleItem,
  StockShortfall,
} from '@/types'
import { balanceFor, grandTotal, itemTotal, normaliseDsNumber, normaliseName } from '@/lib/totals'
import { InsufficientStockError, ValidationError, toErrorMessage } from '@/lib/errors'
import { validateSale } from '@/lib/validation'
import { roundMoney } from '@/lib/money'
import { db } from './firebase'
import { isCategory, numberOrZero, parseStockItem } from './stock.service'

const salesRef = collection(db, 'sales')

export type SalesListener = (sales: Sale[], loaded: boolean) => void

/** Live subscription to every sale, newest first. The permanent ledger. */
export function subscribeSales(
  onChange: SalesListener,
  onError?: (message: string) => void,
): Unsubscribe {
  const q = query(salesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const sales = snapshot.docs
        .map((snap) => toSale(snap))
        .filter((sale): sale is Sale => sale !== null)
      onChange(sales, true)
    },
    (error) => {
      onError?.(toErrorMessage(error, 'Could not load sales.'))
    },
  )
}

/**
 * Validate, then atomically save the sale, decrement the stock of each item and
 * update the customer aggregate.
 *
 * Throws `ValidationError` for bad input and `InsufficientStockError` when the
 * shop does not have enough of an item.
 */
export async function createSale(input: SaleInput): Promise<Sale> {
  const validation = validateSale(input)
  if (!validation.ok) {
    throw new ValidationError(validation.message, validation.fieldErrors)
  }

  const data = validation.data
  const saleRef = doc(salesRef)
  const createdAt = Date.now()
  const nameKey = normaliseName(data.customerName)
  const customerRef = doc(db, 'customers', nameKey)

  return runTransaction(db, async (transaction) => {
    // All reads happen before any write, as Firestore transactions require.
    const stockSnaps: DocumentSnapshot<DocumentData>[] = []
    for (const line of data.items) {
      stockSnaps.push(await transaction.get(doc(db, 'stock', line.stockItemId)))
    }
    const customerSnap = await transaction.get(customerRef)

    const shortfalls: StockShortfall[] = []
    const items: SaleItem[] = []
    const remaining: number[] = []

    data.items.forEach((line, index) => {
      const snap = stockSnaps[index]
      const parsed = snap.exists() ? parseStockItem(snap.id, snap.data()) : null

      if (!parsed) {
        shortfalls.push({
          stockItemId: line.stockItemId,
          name: line.stockItemId,
          requested: line.quantity,
          available: 0,
        })
        return
      }

      if (line.quantity > parsed.quantity) {
        shortfalls.push({
          stockItemId: line.stockItemId,
          name: parsed.name,
          requested: line.quantity,
          available: parsed.quantity,
        })
        return
      }

      items.push({
        stockItemId: line.stockItemId,
        category: parsed.category,
        itemName: parsed.name,
        quantity: line.quantity,
        pricePerUnit: roundMoney(line.pricePerUnit),
        total: itemTotal(line.quantity, line.pricePerUnit),
      })
      remaining.push(parsed.quantity - line.quantity)
    })

    // Another admin may have sold the same item since the form was opened.
    if (shortfalls.length > 0) throw new InsufficientStockError(shortfalls)

    const totalAmount = grandTotal(data.items)
    const amountPaid = roundMoney(data.amountPaid)
    const balanceAmount = balanceFor(totalAmount, amountPaid)

    const sale: Sale = {
      id: saleRef.id,
      customerName: data.customerName,
      nameKey,
      dsNumber: normaliseDsNumber(data.dsNumber),
      date: data.date,
      items,
      totalAmount,
      amountPaid,
      balanceAmount,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      createdAt,
    }

    data.items.forEach((line, index) => {
      transaction.set(
        doc(db, 'stock', line.stockItemId),
        { quantity: remaining[index], updatedAt: createdAt },
        { merge: true },
      )
    })
    transaction.set(saleRef, sale)
    transaction.set(customerRef, mergeCustomer(customerSnap.data(), sale))

    return sale
  })
}

interface CustomerDelta {
  id: string
  name: string
  nameKey: string
  dsNumber: string
  date: string
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  createdAt: number
}

/** Fold a sale into the customer's running aggregate. */
function mergeCustomer(previous: DocumentData | undefined, sale: Sale): CustomerRecord {
  const delta: CustomerDelta = {
    id: sale.nameKey,
    name: sale.customerName,
    nameKey: sale.nameKey,
    dsNumber: sale.dsNumber,
    date: sale.date,
    totalAmount: sale.totalAmount,
    amountPaid: sale.amountPaid,
    balanceAmount: sale.balanceAmount,
    createdAt: sale.createdAt,
  }

  const dsNumbers = Array.isArray(previous?.dsNumbers)
    ? previous.dsNumbers.filter((value): value is string => typeof value === 'string')
    : []
  if (delta.dsNumber && !dsNumbers.includes(delta.dsNumber)) dsNumbers.push(delta.dsNumber)

  const prevFirst = typeof previous?.firstDate === 'string' ? previous.firstDate : ''
  const prevLast = typeof previous?.lastDate === 'string' ? previous.lastDate : ''

  return {
    id: delta.nameKey,
    name: typeof previous?.name === 'string' && previous.name ? previous.name : delta.name,
    nameKey: delta.nameKey,
    dsNumbers,
    saleCount: numberOrZero(previous?.saleCount) + 1,
    totalAmount: roundMoney(numberOrZero(previous?.totalAmount) + delta.totalAmount),
    amountPaid: roundMoney(numberOrZero(previous?.amountPaid) + delta.amountPaid),
    balanceAmount: roundMoney(numberOrZero(previous?.balanceAmount) + delta.balanceAmount),
    firstDate: prevFirst && prevFirst < delta.date ? prevFirst : delta.date,
    lastDate: prevLast && prevLast > delta.date ? prevLast : delta.date,
    updatedAt: delta.createdAt,
  }
}

/** Convert a snapshot into a `Sale`, skipping anything malformed. */
function toSale(snapshot: QueryDocumentSnapshot<DocumentData>): Sale | null {
  const data = snapshot.data()
  if (!data || typeof data.customerName !== 'string' || !Array.isArray(data.items)) return null

  const items = data.items
    .filter(isRecord)
    .map((item) => ({
      stockItemId: typeof item.stockItemId === 'string' ? item.stockItemId : '',
      category: isCategory(item.category) ? item.category : 'hardware',
      itemName: typeof item.itemName === 'string' ? item.itemName : '',
      quantity: numberOrZero(item.quantity),
      pricePerUnit: numberOrZero(item.pricePerUnit),
      total: numberOrZero(item.total),
    }))
    .filter((item) => item.itemName !== '')

  if (items.length === 0) return null

  const customerName = data.customerName

  return {
    id: snapshot.id,
    customerName,
    nameKey: typeof data.nameKey === 'string' ? data.nameKey : normaliseName(customerName),
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

function asPaymentStatus(value: unknown): PaymentStatus {
  return value === 'paid' || value === 'partial' || value === 'unpaid' ? value : 'unpaid'
}

function asPaymentMethod(value: unknown): PaymentMethod {
  return typeof value === 'string' ? (value as PaymentMethod) : 'cash'
}
