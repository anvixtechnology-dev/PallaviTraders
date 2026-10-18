import { describe, expect, it } from 'vitest'

import type { PaymentStatus, Sale, SaleItem } from '@/types'
import { groupSalesByCustomer, saleItemSummary, saleMatches } from './customers'

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

describe('groupSalesByCustomer', () => {
  it('folds every sale of one customer into a single group', () => {
    const groups = groupSalesByCustomer([
      sale({ id: 's1', totalAmount: 1000, amountPaid: 1000, balanceAmount: 0 }),
      sale({
        id: 's2',
        date: '2026-03-10',
        totalAmount: 500,
        amountPaid: 200,
        balanceAmount: 300,
        paymentStatus: 'partial',
      }),
      sale({ id: 's3', customerName: 'Other Co', nameKey: 'other co' }),
    ])

    expect(groups).toHaveLength(2)

    const ramesh = groups[0]
    expect(ramesh.nameKey).toBe('ramesh traders')
    expect(ramesh.name).toBe('Ramesh Traders')
    expect(ramesh.saleCount).toBe(2)
    expect(ramesh.totalAmount).toBe(1500)
    expect(ramesh.amountPaid).toBe(1200)
    expect(ramesh.balanceAmount).toBe(300)
    expect(ramesh.lastDate).toBe('2026-03-10')
    expect(ramesh.paymentStatus).toBe('partial')
    expect(ramesh.sales.map((entry) => entry.id)).toEqual(['s1', 's2'])
  })

  it('derives a paid status when the group is settled', () => {
    const [group] = groupSalesByCustomer([sale()])
    expect(group.paymentStatus).toBe('paid')
    expect(group.saleCount).toBe(1)
  })

  it('returns no groups for no sales', () => {
    expect(groupSalesByCustomer([])).toEqual([])
  })
})
