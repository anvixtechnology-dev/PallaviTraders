import { describe, expect, it } from 'vitest'

import type { SaleInput } from '@/types'
import { validateSale } from './validation'

function baseInput(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    customerName: 'Ramesh Traders',
    dsNumber: 'DS-101',
    date: '2026-03-05',
    items: [{ stockItemId: 'item-1', quantity: 10, pricePerUnit: 100 }],
    amountPaid: 1000,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    ...overrides,
  }
}

describe('validateSale — happy path', () => {
  it('accepts a complete sale and trims the text fields', () => {
    const result = validateSale(
      baseInput({ customerName: '  Ramesh Traders  ', dsNumber: ' DS-101 ' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.customerName).toBe('Ramesh Traders')
      expect(result.data.dsNumber).toBe('DS-101')
    }
  })

  it('accepts a fully unpaid sale', () => {
    expect(validateSale(baseInput({ amountPaid: 0, paymentStatus: 'unpaid' })).ok).toBe(true)
  })

  it('accepts a partial payment', () => {
    expect(validateSale(baseInput({ amountPaid: 400, paymentStatus: 'partial' })).ok).toBe(true)
  })

  it('accepts fractional quantities', () => {
    const result = validateSale(
      baseInput({
        items: [{ stockItemId: 'hw-1', quantity: 2.5, pricePerUnit: 40 }],
        amountPaid: 100,
      }),
    )
    expect(result.ok).toBe(true)
  })
})

describe('validateSale — required fields', () => {
  it('requires a customer name', () => {
    const result = validateSale(baseInput({ customerName: '   ' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.customerName).toBeDefined()
  })

  it('requires a DS number', () => {
    const result = validateSale(baseInput({ dsNumber: '' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.dsNumber).toBeDefined()
  })

  it('requires at least one item', () => {
    const result = validateSale(baseInput({ items: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/at least one item/i)
  })

  it('rejects a zero quantity', () => {
    const result = validateSale(
      baseInput({ items: [{ stockItemId: 'p1', quantity: 0, pricePerUnit: 100 }] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors['item.0.quantity']).toBeDefined()
  })

  it('rejects a negative price', () => {
    const result = validateSale(
      baseInput({ items: [{ stockItemId: 'p1', quantity: 1, pricePerUnit: -5 }] }),
    )
    expect(result.ok).toBe(false)
  })

  it('rejects impossible precision', () => {
    const result = validateSale(
      baseInput({ items: [{ stockItemId: 'p1', quantity: 0.0001, pricePerUnit: 100 }] }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateSale — dates', () => {
  it('rejects a malformed date', () => {
    const result = validateSale(baseInput({ date: '05-03-2026' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.date).toBeDefined()
  })

  it('rejects a date that does not exist', () => {
    expect(validateSale(baseInput({ date: '2026-02-31' })).ok).toBe(false)
  })

  it('accepts a real date', () => {
    expect(validateSale(baseInput({ date: '2024-02-29' })).ok).toBe(true)
  })
})

describe('validateSale — payment consistency', () => {
  it('rejects "Paid" when the amount does not cover the total', () => {
    const result = validateSale(baseInput({ amountPaid: 400, paymentStatus: 'paid' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.amountPaid).toBeDefined()
  })

  it('rejects "Unpaid" when an amount was entered', () => {
    expect(validateSale(baseInput({ amountPaid: 400, paymentStatus: 'unpaid' })).ok).toBe(false)
  })

  it('rejects "Partially Paid" when the total is fully covered', () => {
    expect(
      validateSale(baseInput({ amountPaid: 1000, paymentStatus: 'partial' })).ok,
    ).toBe(false)
  })

  it('rejects a negative amount paid', () => {
    expect(
      validateSale(baseInput({ amountPaid: -50, paymentStatus: 'partial' })).ok,
    ).toBe(false)
  })
})

describe('validateSale — item rules', () => {
  it('rejects the same stock item listed twice', () => {
    const result = validateSale(
      baseInput({
        items: [
          { stockItemId: 'p1', quantity: 1, pricePerUnit: 10 },
          { stockItemId: 'p1', quantity: 2, pricePerUnit: 10 },
        ],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/only be added once/i)
  })

  it('accepts several different items together', () => {
    const result = validateSale(
      baseInput({
        items: [
          { stockItemId: 'p1', quantity: 1, pricePerUnit: 10 },
          { stockItemId: 's1', quantity: 2, pricePerUnit: 20 },
          { stockItemId: 'h1', quantity: 3, pricePerUnit: 30 },
        ],
        amountPaid: 170,
      }),
    )
    expect(result.ok).toBe(true)
  })
})
