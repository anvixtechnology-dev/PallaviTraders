import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PurchaseInput } from '@/types'

/* Mocked Firestore surface. `runTransaction` simply invokes the callback with a
   fake transaction so the real control flow inside `createPurchase` runs. */
const transaction = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __collection: 'purchases' })),
  doc: vi.fn((..._args: unknown[]) => ({ __doc: true })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(async (_db: unknown, callback: (tx: unknown) => unknown) =>
    callback(transaction),
  ),
}))

vi.mock('@/services/firebase', () => ({
  db: { __db: true },
  auth: {},
  getDb: () => ({ __db: true }),
}))

const { createPurchase } = await import('./purchases.service')
const { InsufficientStockError, ValidationError } = await import('@/lib/errors')

function input(overrides: Partial<PurchaseInput> = {}): PurchaseInput {
  return {
    customerName: 'Ramesh Traders',
    dsNumber: 'DS-101',
    date: '2026-03-05',
    items: [{ category: 'pipes', quantity: 10, pricePerUnit: 100 }],
    amountPaid: 1000,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    ...overrides,
  }
}

function storedStock(stock: Record<string, number> | null) {
  return { exists: () => stock !== null, data: () => stock }
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.get.mockResolvedValue(storedStock({ pipes: 100, sheets: 50, hardware: 20 }))
})

describe('createPurchase', () => {
  it('writes the purchase and reduces the stock counters', async () => {
    const result = await createPurchase(input())

    expect(result.stockAfter).toEqual({ pipes: 90, sheets: 50, hardware: 20 })

    // One write for stock, one for the purchase.
    expect(transaction.set).toHaveBeenCalledTimes(2)

    const stockWrite = transaction.set.mock.calls[0][1] as Record<string, number>
    expect(stockWrite.pipes).toBe(90)
    expect(stockWrite.sheets).toBe(50)

    const purchaseWrite = transaction.set.mock.calls[1][1] as Record<string, unknown>
    expect(purchaseWrite.customerName).toBe('Ramesh Traders')
    expect(purchaseWrite.dsNumber).toBe('DS-101')
    expect(purchaseWrite.totalAmount).toBe(1000)
    expect(purchaseWrite.amountPaid).toBe(1000)
    expect(purchaseWrite.balanceAmount).toBe(0)
    expect(purchaseWrite.paymentStatus).toBe('paid')
    expect(purchaseWrite.paymentMethod).toBe('cash')
  })

  it('stores a snapshot of each line with its own total', async () => {
    await createPurchase(
      input({
        items: [
          { category: 'pipes', quantity: 10, pricePerUnit: 100 },
          { category: 'sheets', quantity: 4, pricePerUnit: 250.5 },
        ],
        amountPaid: 2002,
      }),
    )

    const purchaseWrite = transaction.set.mock.calls[1][1] as {
      items: { category: string; quantity: number; pricePerUnit: number; total: number }[]
      totalAmount: number
    }

    expect(purchaseWrite.items).toEqual([
      { category: 'pipes', quantity: 10, pricePerUnit: 100, total: 1000 },
      { category: 'sheets', quantity: 4, pricePerUnit: 250.5, total: 1002 },
    ])
    expect(purchaseWrite.totalAmount).toBe(2002)
  })

  it('reduces every selected category', async () => {
    const result = await createPurchase(
      input({
        items: [
          { category: 'pipes', quantity: 10, pricePerUnit: 10 },
          { category: 'sheets', quantity: 20, pricePerUnit: 10 },
          { category: 'hardware', quantity: 5, pricePerUnit: 10 },
        ],
        amountPaid: 350,
      }),
    )

    expect(result.stockAfter).toEqual({ pipes: 90, sheets: 30, hardware: 15 })
  })

  it('works when the stock document does not exist yet', async () => {
    transaction.get.mockResolvedValue(storedStock(null))
    await expect(createPurchase(input())).rejects.toBeInstanceOf(InsufficientStockError)
  })

  it('refuses to oversell and writes nothing', async () => {
    await expect(
      createPurchase(
        input({
          items: [{ category: 'hardware', quantity: 25, pricePerUnit: 40 }],
          amountPaid: 1000,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError)

    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('allows selling the exact quantity in stock', async () => {
    const result = await createPurchase(
      input({
        items: [{ category: 'pipes', quantity: 100, pricePerUnit: 10 }],
        amountPaid: 1000,
      }),
    )
    expect(result.stockAfter.pipes).toBe(0)
  })

  it('rejects invalid input before touching Firestore', async () => {
    await expect(createPurchase(input({ customerName: '' }))).rejects.toBeInstanceOf(ValidationError)
    expect(transaction.get).not.toHaveBeenCalled()
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('rejects a payment status that contradicts the amount paid', async () => {
    await expect(
      createPurchase(input({ amountPaid: 400, paymentStatus: 'paid' })),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('records a partial payment with the balance outstanding', async () => {
    await createPurchase(input({ amountPaid: 400, paymentStatus: 'partial' }))

    const purchaseWrite = transaction.set.mock.calls[1][1] as Record<string, unknown>
    expect(purchaseWrite.amountPaid).toBe(400)
    expect(purchaseWrite.balanceAmount).toBe(600)
    expect(purchaseWrite.paymentStatus).toBe('partial')
  })

  it('records an unpaid purchase', async () => {
    await createPurchase(input({ amountPaid: 0, paymentStatus: 'unpaid' }))

    const purchaseWrite = transaction.set.mock.calls[1][1] as Record<string, unknown>
    expect(purchaseWrite.amountPaid).toBe(0)
    expect(purchaseWrite.balanceAmount).toBe(1000)
    expect(purchaseWrite.paymentStatus).toBe('unpaid')
  })

  it('stores a searchable name key', async () => {
    await createPurchase(input({ customerName: '  Ramesh   Traders  ' }))

    const purchaseWrite = transaction.set.mock.calls[1][1] as Record<string, unknown>
    expect(purchaseWrite.customerName).toBe('Ramesh   Traders')
    expect(purchaseWrite.nameKey).toBe('ramesh traders')
  })
})
