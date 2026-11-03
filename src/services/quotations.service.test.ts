import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NoneItem, Quotation, QuotationInput } from '@/types'

/** A one-collection, in-memory stand-in for Firestore. */
const store = vi.hoisted(() => new Map<string, Record<string, unknown>>())

vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => {
  const snap = (id: string) => ({
    id,
    exists: () => store.has(id),
    data: () => store.get(id),
  })
  let nextId = 1
  return {
    collection: () => ({}),
    query: () => ({}),
    orderBy: () => ({}),
    doc: (_ref: unknown, id?: string) => ({ id: id ?? `doc-${nextId++}` }),
    setDoc: async (ref: { id: string }, data: Record<string, unknown>) => {
      store.set(ref.id, JSON.parse(JSON.stringify(data)))
    },
    updateDoc: async (ref: { id: string }, data: Record<string, unknown>) => {
      store.set(ref.id, { ...store.get(ref.id), ...JSON.parse(JSON.stringify(data)) })
    },
    getDoc: async (ref: { id: string }) => snap(ref.id),
    getDocs: async () => ({ docs: [...store.keys()].map(snap) }),
    onSnapshot: (_q: unknown, onNext: (s: { docs: ReturnType<typeof snap>[] }) => void) => {
      onNext({ docs: [...store.keys()].map(snap) })
      return () => undefined
    },
    deleteDoc: async (ref: { id: string }) => {
      store.delete(ref.id)
    },
  }
})

const { createQuotation, subscribeQuotations, updateQuotation } = await import(
  './quotations.service'
)

function readAll(): Quotation[] {
  let result: Quotation[] = []
  subscribeQuotations((quotations) => {
    result = quotations
  })
  return result
}

const baseInput: QuotationInput = {
  quotationNumber: 'PIT/0001',
  customerName: 'Ramesh Traders',
  customerGstNumber: '',
  referenceNumber: '',
  place: '',
  date: '2026-03-05',
  items: [
    {
      category: 'none',
      itemType: 'Iron Material',
      size: '40 mm',
      lengthFt: 12,
      quantity: 10,
      weightPerItemKg: 5,
      ratePerKg: 60,
    },
    {
      category: 'pipes',
      pipeType: 'round',
      size: '1/2"',
      weightPerPipeKg: 10,
      quantity: 10,
      ratePerKg: 86,
    },
  ],
}

describe('None items through the quotation service', () => {
  beforeEach(() => store.clear())

  it('reads a saved None item back as a None item, not a legacy pipe', async () => {
    const { id } = await createQuotation(baseInput)

    expect(store.get(id)?.items).toContainEqual(expect.objectContaining({ category: 'none' }))

    const [loaded] = readAll()
    expect(loaded.items[0]).toEqual({
      category: 'none',
      itemType: 'Iron Material',
      size: '40 mm',
      lengthFt: 12,
      quantity: 10,
      weightPerItemKg: 5,
      ratePerKg: 60,
      totalWeightKg: 50,
      amount: 3000,
    })
    expect(loaded.noneTotal).toBe(3000)
    expect(loaded.pipesTotal).toBe(8600)
    expect(loaded.grandTotal).toBe(11600)
  })

  it('updates in place, recalculating and keeping the id and createdAt', async () => {
    const created = await createQuotation(baseInput)
    store.set(created.id, { ...store.get(created.id), createdAt: 1000, updatedAt: 1000 })

    const [none, pipe] = baseInput.items
    await updateQuotation(created.id, {
      ...baseInput,
      items: [{ ...none, weightPerItemKg: 4 } as typeof none, pipe],
    })

    const all = readAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
    expect(all[0].createdAt).toBe(1000)
    expect(all[0].updatedAt).toBeGreaterThan(1000)

    const item = all[0].items[0] as NoneItem
    expect(item).toMatchObject({
      weightPerItemKg: 4,
      totalWeightKg: 40,
      amount: 2400,
    })
    expect(all[0].grandTotal).toBe(11000)
  })

  it('computes the None total for quotations saved before the category existed', () => {
    store.set('old', {
      quotationNumber: 'PIT/0002',
      items: [],
      pipesTotal: 100,
      sheetsTotal: 0,
      hardwareTotal: 0,
      grandTotal: 100,
    })
    const [loaded] = readAll()
    expect(loaded.noneTotal).toBe(0)
    expect(loaded.grandTotal).toBe(100)
  })
})
