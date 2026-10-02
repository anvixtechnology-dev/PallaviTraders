import { describe, expect, it } from 'vitest'

import type { PaymentStatus, Purchase } from '@/types'
import { customerMatches, groupPurchasesByCustomer, purchasedCategories } from './customers'

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'p1',
    customerName: 'Ramesh Traders',
    nameKey: 'ramesh traders',
    dsNumber: 'DS-101',
    date: '2026-03-05',
    items: [{ category: 'pipes', quantity: 10, pricePerUnit: 100, total: 1000 }],
    totalAmount: 1000,
    amountPaid: 1000,
    balanceAmount: 0,
    paymentStatus: 'paid' as PaymentStatus,
    paymentMethod: 'cash',
    createdAt: 1,
    ...overrides,
  }
}

describe('groupPurchasesByCustomer', () => {
  it('returns an empty list for no purchases', () => {
    expect(groupPurchasesByCustomer([])).toEqual([])
  })

  it('keeps one summary per customer and sums their money', () => {
    const customers = groupPurchasesByCustomer([
      purchase({ id: 'a', totalAmount: 1000, amountPaid: 1000, balanceAmount: 0 }),
      purchase({
        id: 'b',
        date: '2026-03-09',
        totalAmount: 500.5,
        amountPaid: 200,
        balanceAmount: 300.5,
        createdAt: 2,
      }),
      purchase({
        id: 'c',
        customerName: 'Suresh Hardware',
        nameKey: 'suresh hardware',
        totalAmount: 99,
        createdAt: 3,
      }),
    ])

    expect(customers).toHaveLength(2)

    const ramesh = customers[0]
    expect(ramesh.name).toBe('Ramesh Traders')
    expect(ramesh.purchaseCount).toBe(2)
    expect(ramesh.totalAmount).toBe(1500.5)
    expect(ramesh.amountPaid).toBe(1200)
    expect(ramesh.balanceAmount).toBe(300.5)
  })

  it('orders purchases newest first inside a customer', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({ id: 'old', date: '2026-01-02', createdAt: 1 }),
      purchase({ id: 'new', date: '2026-05-06', createdAt: 2 }),
      purchase({ id: 'mid', date: '2026-03-04', createdAt: 3 }),
    ])

    expect(customer.purchases.map((entry) => entry.id)).toEqual(['new', 'mid', 'old'])
  })

  it('breaks a same-day tie on createdAt', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({ id: 'first', date: '2026-03-05', createdAt: 1 }),
      purchase({ id: 'second', date: '2026-03-05', createdAt: 2 }),
    ])

    expect(customer.purchases.map((entry) => entry.id)).toEqual(['second', 'first'])
  })

  it('records the first and last purchase dates', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({ id: 'a', date: '2026-02-01', createdAt: 1 }),
      purchase({ id: 'b', date: '2026-07-19', createdAt: 2 }),
    ])

    expect(customer.firstDate).toBe('2026-02-01')
    expect(customer.lastDate).toBe('2026-07-19')
  })

  it('orders customers by their most recent purchase', () => {
    const customers = groupPurchasesByCustomer([
      purchase({
        id: 'stale',
        customerName: 'Old Client',
        nameKey: 'old client',
        date: '2025-01-01',
      }),
      purchase({
        id: 'fresh',
        customerName: 'New Client',
        nameKey: 'new client',
        date: '2026-06-01',
      }),
    ])

    expect(customers.map((customer) => customer.name)).toEqual(['New Client', 'Old Client'])
  })

  it('takes the displayed name from the most recent purchase', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({ id: 'a', customerName: 'ramesh  traders', date: '2026-01-01' }),
      purchase({ id: 'b', customerName: 'Ramesh Traders', date: '2026-08-01' }),
    ])

    expect(customer.name).toBe('Ramesh Traders')
  })

  it('collects distinct DS numbers without duplicates or blanks', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({ id: 'a', dsNumber: 'DS-101', date: '2026-03-01' }),
      purchase({ id: 'b', dsNumber: 'DS-101', date: '2026-03-02' }),
      purchase({ id: 'c', dsNumber: 'DS-202', date: '2026-03-03' }),
      purchase({ id: 'd', dsNumber: '', date: '2026-03-04' }),
    ])

    expect(customer.dsNumbers).toEqual(['DS-202', 'DS-101'])
  })

  it('totals quantities per category across every purchase', () => {
    const [customer] = groupPurchasesByCustomer([
      purchase({
        id: 'a',
        items: [{ category: 'pipes', quantity: 10, pricePerUnit: 100, total: 1000 }],
      }),
      purchase({
        id: 'b',
        date: '2026-03-06',
        items: [
          { category: 'pipes', quantity: 5, pricePerUnit: 100, total: 500 },
          { category: 'sheets', quantity: 2, pricePerUnit: 50, total: 100 },
        ],
      }),
    ])

    expect(customer.quantities).toEqual({ pipes: 15, sheets: 2, hardware: 0 })
  })

  it('does not mutate the array it is given', () => {
    const input = [
      purchase({ id: 'a', date: '2026-01-01' }),
      purchase({ id: 'b', date: '2026-05-01' }),
    ]
    const order = input.map((entry) => entry.id)

    groupPurchasesByCustomer(input)

    expect(input.map((entry) => entry.id)).toEqual(order)
  })
})

describe('purchasedCategories', () => {
  it('lists only categories with a quantity, in fixed order', () => {
    expect(purchasedCategories({ pipes: 10, sheets: 0, hardware: 2 })).toEqual([
      'pipes',
      'hardware',
    ])
  })

  it('returns nothing when the customer bought nothing', () => {
    expect(purchasedCategories({ pipes: 0, sheets: 0, hardware: 0 })).toEqual([])
  })
})

describe('customerMatches', () => {
  const [customer] = groupPurchasesByCustomer([
    purchase({ id: 'a', dsNumber: 'DS-101', date: '2026-03-01' }),
    purchase({
      id: 'b',
      dsNumber: 'DS-202',
      date: '2026-03-02',
      items: [{ category: 'sheets', quantity: 2, pricePerUnit: 50, total: 100 }],
    }),
  ])

  it('matches everything for an empty query', () => {
    expect(customerMatches(customer, '')).toBe(true)
    expect(customerMatches(customer, '   ')).toBe(true)
  })

  it('matches the customer name regardless of case', () => {
    expect(customerMatches(customer, 'RAMESH')).toBe(true)
  })

  it('matches a DS number', () => {
    expect(customerMatches(customer, 'ds-202')).toBe(true)
  })

  it('matches a category bought at any point', () => {
    expect(customerMatches(customer, 'sheets')).toBe(true)
  })

  it('rejects a query that matches nothing', () => {
    expect(customerMatches(customer, 'nothing-here')).toBe(false)
  })
})