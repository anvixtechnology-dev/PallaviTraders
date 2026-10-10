import { describe, expect, it } from 'vitest'

import {
  balanceFor,
  derivePaymentStatus,
  grandTotal,
  itemTotal,
  normaliseDsNumber,
  normaliseName,
} from './totals'

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
    expect(
      grandTotal([
        { quantity: 10, pricePerUnit: 100 },
        { quantity: 4, pricePerUnit: 250 },
        { quantity: 5, pricePerUnit: 40 },
      ]),
    ).toBe(2200)
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
