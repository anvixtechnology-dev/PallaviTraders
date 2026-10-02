import { describe, expect, it } from 'vitest'

import type { PurchaseItemInput, Stock } from '@/types'
import {
  balanceFor,
  derivePaymentStatus,
  findShortfalls,
  grandTotal,
  itemTotal,
  nextStock,
  normaliseDsNumber,
  normaliseName,
  quantitiesByCategory,
  sanitiseStock,
} from './totals'

const stock: Stock = { pipes: 100, sheets: 50, hardware: 20 }

function item(quantity: number, pricePerUnit: number): PurchaseItemInput {
  return { category: 'pipes', quantity, pricePerUnit }
}

describe('itemTotal', () => {
  it('multiplies quantity by price', () => {
    expect(itemTotal(10, 25.5)).toBe(255)
  })

  it('avoids floating point drift', () => {
    expect(itemTotal(3, 0.1)).toBe(0.3)
    expect(itemTotal(7, 19.99)).toBe(139.93)
  })

  it('treats missing values as zero', () => {
    expect(itemTotal(Number.NaN, 100)).toBe(0)
  })
})

describe('grandTotal', () => {
  it('sums every line', () => {
    const items: PurchaseItemInput[] = [
      { category: 'pipes', quantity: 10, pricePerUnit: 100 },
      { category: 'sheets', quantity: 4, pricePerUnit: 250 },
      { category: 'hardware', quantity: 5, pricePerUnit: 40 },
    ]
    expect(grandTotal(items)).toBe(2200)
  })

  it('is zero when nothing is selected', () => {
    expect(grandTotal([])).toBe(0)
  })
})

describe('derivePaymentStatus', () => {
  it('is paid when the amount covers the total', () => {
    expect(derivePaymentStatus(1000, 1000)).toBe('paid')
    expect(derivePaymentStatus(1000, 1200)).toBe('paid')
  })

  it('is partial when some money came in', () => {
    expect(derivePaymentStatus(1000, 400)).toBe('partial')
  })

  it('is unpaid when nothing came in', () => {
    expect(derivePaymentStatus(1000, 0)).toBe('unpaid')
  })

  it('treats a zero total as paid', () => {
    expect(derivePaymentStatus(0, 0)).toBe('paid')
  })
})

describe('balanceFor', () => {
  it('is the total minus the amount paid', () => {
    expect(balanceFor(1000, 400)).toBe(600)
  })

  it('never goes negative on overpayment', () => {
    expect(balanceFor(1000, 1500)).toBe(0)
  })

  it('is zero when fully paid', () => {
    expect(balanceFor(1000, 1000)).toBe(0)
  })
})

describe('quantitiesByCategory', () => {
  it('groups quantities per category', () => {
    const items: PurchaseItemInput[] = [
      { category: 'pipes', quantity: 10, pricePerUnit: 0 },
      { category: 'pipes', quantity: 5, pricePerUnit: 0 },
      { category: 'sheets', quantity: 2, pricePerUnit: 0 },
    ]
    expect(quantitiesByCategory(items)).toEqual({ pipes: 15, sheets: 2, hardware: 0 })
  })
})

describe('findShortfalls', () => {
  it('returns nothing when stock is sufficient', () => {
    expect(findShortfalls(stock, [{ category: 'pipes', quantity: 100, pricePerUnit: 0 }])).toEqual([])
  })

  it('flags a category that is oversold', () => {
    const shortfalls = findShortfalls(stock, [{ category: 'hardware', quantity: 25, pricePerUnit: 0 }])
    expect(shortfalls).toEqual([{ category: 'hardware', requested: 25, available: 20 }])
  })

  it('flags every oversold category at once', () => {
    const shortfalls = findShortfalls(stock, [
      { category: 'pipes', quantity: 101, pricePerUnit: 0 },
      { category: 'sheets', quantity: 51, pricePerUnit: 0 },
    ])
    expect(shortfalls.map((s) => s.category)).toEqual(['pipes', 'sheets'])
  })

  it('does not flag a category that was not selected', () => {
    expect(findShortfalls(stock, [{ category: 'pipes', quantity: 1, pricePerUnit: 0 }])).toEqual([])
  })
})

describe('nextStock', () => {
  it('subtracts the purchased quantity', () => {
    const result = nextStock(stock, [{ category: 'pipes', quantity: 10, pricePerUnit: 0 }])
    expect(result).toEqual({ pipes: 90, sheets: 50, hardware: 20 })
  })

  it('subtracts from every selected category', () => {
    const result = nextStock(stock, [
      { category: 'pipes', quantity: 10, pricePerUnit: 0 },
      { category: 'sheets', quantity: 20, pricePerUnit: 0 },
      { category: 'hardware', quantity: 5, pricePerUnit: 0 },
    ])
    expect(result).toEqual({ pipes: 90, sheets: 30, hardware: 15 })
  })

  it('never produces a negative count', () => {
    const result = nextStock(stock, [{ category: 'hardware', quantity: 999, pricePerUnit: 0 }])
    expect(result).toEqual({ pipes: 100, sheets: 50, hardware: 0 })
  })
})

describe('normaliseName', () => {
  it('trims, collapses spaces and lowercases', () => {
    expect(normaliseName('  Ramesh   Traders  ')).toBe('ramesh traders')
  })
})

describe('normaliseDsNumber', () => {
  it('strips whitespace', () => {
    expect(normaliseDsNumber(' DS 12 ')).toBe('DS12')
  })
})

describe('sanitiseStock', () => {
  it('fills missing categories with zero', () => {
    expect(sanitiseStock({ pipes: 12 })).toEqual({ pipes: 12, sheets: 0, hardware: 0 })
  })

  it('rejects negative and non-numeric values', () => {
    expect(sanitiseStock({ pipes: -5, sheets: 'ten' as unknown as number, hardware: 3 })).toEqual({
      pipes: 0,
      sheets: 0,
      hardware: 3,
    })
  })

  it('handles a missing document', () => {
    expect(sanitiseStock(undefined)).toEqual({ pipes: 0, sheets: 0, hardware: 0 })
  })
})

describe('example from the spec', () => {
  it('reduces 100 pipes to 90 after selling 10', () => {
    expect(nextStock({ pipes: 100, sheets: 0, hardware: 0 }, [item(10, 0)]).pipes).toBe(90)
  })
})
