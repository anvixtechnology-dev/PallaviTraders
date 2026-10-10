import { describe, expect, it } from 'vitest'

import type { PaymentStatus, Sale, SaleItem } from '@/types'
import { saleItemSummary, saleMatches } from './customers'

function saleItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    stockItemId: 'p1',
    category: 'pipes',
    itemName: 'GI Pipe 2 inch',
    quantity: 10,
    pricePerUnit: 100,
    total: 1000,
    ...overrides,
  }
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    customerName: 'Ramesh Traders',
    nameKey: 'ramesh traders',
    dsNumber: 'DS-101',
    date: '2026-03-05',
    items: [saleItem()],
    totalAmount: 1000,
    amountPaid: 1000,
    balanceAmount: 0,
    paymentStatus: 'paid' as PaymentStatus,
    paymentMethod: 'cash',
    createdAt: 1,
    ...overrides,
  }
}

describe('saleItemSummary', () => {
  it('joins the item names', () => {
    expect(
      saleItemSummary(
        sale({
          items: [
            saleItem({ itemName: 'GI Pipe' }),
            saleItem({ stockItemId: 's1', itemName: 'MS Sheet', category: 'sheets' }),
          ],
        }),
      ),
    ).toBe('GI Pipe, MS Sheet')
  })

  it('is empty when there are no items', () => {
    expect(saleItemSummary(sale({ items: [] }))).toBe('')
  })
})

describe('saleMatches', () => {
  it('matches everything for an empty query', () => {
    expect(saleMatches(sale(), '')).toBe(true)
    expect(saleMatches(sale(), '   ')).toBe(true)
  })

  it('matches the customer name regardless of case', () => {
    expect(saleMatches(sale(), 'RAMESH')).toBe(true)
  })

  it('matches a DS number', () => {
    expect(saleMatches(sale(), 'ds-101')).toBe(true)
  })

  it('matches an item name bought on the sale', () => {
    expect(saleMatches(sale(), 'pipe')).toBe(true)
  })

  it('rejects a query that matches nothing', () => {
    expect(saleMatches(sale(), 'nothing-here')).toBe(false)
  })
})
