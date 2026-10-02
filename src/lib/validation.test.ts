import { describe, expect, it } from 'vitest'

import type { PurchaseInput } from '@/types'
import { validatePurchase } from './validation'

function baseInput(overrides: Partial<PurchaseInput> = {}): PurchaseInput {
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

describe('validatePurchase — happy path', () => {
  it('accepts a complete purchase and trims the text fields', () => {
    const result = validatePurchase(
      baseInput({ customerName: '  Ramesh Traders  ', dsNumber: ' DS-101 ' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.customerName).toBe('Ramesh Traders')
      expect(result.data.dsNumber).toBe('DS-101')
    }
  })

  it('accepts a fully unpaid purchase', () => {
    const result = validatePurchase(baseInput({ amountPaid: 0, paymentStatus: 'unpaid' }))
    expect(result.ok).toBe(true)
  })

  it('accepts a partial payment', () => {
    const result = validatePurchase(baseInput({ amountPaid: 400, paymentStatus: 'partial' }))
    expect(result.ok).toBe(true)
  })

  it('accepts fractional quantities', () => {
    const result = validatePurchase(
      baseInput({
        items: [{ category: 'hardware', quantity: 2.5, pricePerUnit: 40 }],
        amountPaid: 100,
      }),
    )
    expect(result.ok).toBe(true)
  })
})

describe('validatePurchase — required fields', () => {
  it('requires a customer name', () => {
    const result = validatePurchase(baseInput({ customerName: '   ' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.customerName).toBeDefined()
  })

  it('requires a DS number', () => {
    const result = validatePurchase(baseInput({ dsNumber: '' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.dsNumber).toBeDefined()
  })

  it('requires at least one item', () => {
    const result = validatePurchase(baseInput({ items: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/at least one item/i)
  })

  it('rejects a zero quantity', () => {
    const result = validatePurchase(
      baseInput({ items: [{ category: 'pipes', quantity: 0, pricePerUnit: 100 }] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors['item.pipes.quantity']).toBeDefined()
  })

  it('rejects a negative price', () => {
    const result = validatePurchase(
      baseInput({ items: [{ category: 'pipes', quantity: 1, pricePerUnit: -5 }] }),
    )
    expect(result.ok).toBe(false)
  })

  it('rejects impossible precision', () => {
    const result = validatePurchase(
      baseInput({ items: [{ category: 'pipes', quantity: 0.0001, pricePerUnit: 100 }] }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('validatePurchase — dates', () => {
  it('rejects a malformed date', () => {
    const result = validatePurchase(baseInput({ date: '05-03-2026' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.date).toBeDefined()
  })

  it('rejects a date that does not exist', () => {
    const result = validatePurchase(baseInput({ date: '2026-02-31' }))
    expect(result.ok).toBe(false)
  })

  it('accepts a real date', () => {
    expect(validatePurchase(baseInput({ date: '2024-02-29' })).ok).toBe(true)
  })
})

describe('validatePurchase — payment consistency', () => {
  it('rejects "Paid" when the amount does not cover the total', () => {
    const result = validatePurchase(baseInput({ amountPaid: 400, paymentStatus: 'paid' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.amountPaid).toBeDefined()
  })

  it('rejects "Unpaid" when an amount was entered', () => {
    const result = validatePurchase(baseInput({ amountPaid: 400, paymentStatus: 'unpaid' }))
    expect(result.ok).toBe(false)
  })

  it('rejects "Partially Paid" when the total is fully covered', () => {
    const result = validatePurchase(baseInput({ amountPaid: 1000, paymentStatus: 'partial' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a negative amount paid', () => {
    const result = validatePurchase(baseInput({ amountPaid: -50, paymentStatus: 'partial' }))
    expect(result.ok).toBe(false)
  })
})

describe('validatePurchase — item rules', () => {
  it('rejects the same category listed twice', () => {
    const result = validatePurchase(
      baseInput({
        items: [
          { category: 'pipes', quantity: 1, pricePerUnit: 10 },
          { category: 'pipes', quantity: 2, pricePerUnit: 10 },
        ],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/only be added once/i)
  })

  it('accepts all three categories together', () => {
    const result = validatePurchase(
      baseInput({
        items: [
          { category: 'pipes', quantity: 1, pricePerUnit: 10 },
          { category: 'sheets', quantity: 2, pricePerUnit: 20 },
          { category: 'hardware', quantity: 3, pricePerUnit: 30 },
        ],
        amountPaid: 170,
      }),
    )
    expect(result.ok).toBe(true)
  })
})
