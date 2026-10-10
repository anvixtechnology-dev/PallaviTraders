import { describe, expect, it } from 'vitest'

import type { QuotationInput } from '@/types'
import {
  BUSINESS,
  GSTIN,
  buildQuotation,
  quotationGrandTotal,
  quotationItemAmount,
  quotationWhatsAppMessage,
  validateQuotation,
  whatsAppUrl,
} from './quotations'

function item(overrides: Partial<QuotationInput['items'][number]> = {}) {
  return {
    description: 'GI Pipe',
    size: '2 inch',
    quantity: 1,
    thickness: '3 mm',
    weightKg: 100,
    ratePerKg: 80,
    ...overrides,
  }
}

function input(overrides: Partial<QuotationInput> = {}): QuotationInput {
  return {
    quotationNumber: 'PIT/0001',
    customerName: 'Ramesh Traders',
    referenceNumber: 'REF-1',
    place: 'Bhimavaram',
    date: '2026-03-05',
    items: [item()],
    ...overrides,
  }
}

describe('fixed business details', () => {
  it('uses the shop GSTIN', () => {
    expect(GSTIN).toBe('37BPXPS5746G1ZY')
    expect(BUSINESS.gstin).toBe(GSTIN)
    expect(BUSINESS.name).toBe('PALLAVI IRON TRADERS')
    expect(BUSINESS.proprietor).toBe('Merugu Srinivas')
  })
})

describe('quotationItemAmount', () => {
  it('multiplies weight by rate', () => {
    expect(quotationItemAmount(item({ weightKg: 12.5, ratePerKg: 80 }))).toBe(1000)
  })

  it('treats missing values as zero', () => {
    expect(quotationItemAmount(item({ weightKg: Number.NaN }))).toBe(0)
  })
})

describe('quotationGrandTotal', () => {
  it('sums every line', () => {
    expect(
      quotationGrandTotal([
        item({ weightKg: 10, ratePerKg: 100 }),
        item({ weightKg: 5, ratePerKg: 20 }),
      ]),
    ).toBe(1100)
  })

  it('is zero without items', () => {
    expect(quotationGrandTotal([])).toBe(0)
  })
})

describe('buildQuotation', () => {
  it('calculates per-line amounts, the grand total and words', () => {
    const quotation = buildQuotation(input())
    expect(quotation.items[0].amount).toBe(8000)
    expect(quotation.grandTotal).toBe(8000)
    expect(quotation.amountInWords).toBe('Rupees Eight Thousand Only')
  })

  it('trims text fields', () => {
    const quotation = buildQuotation(input({ customerName: '  Ramesh  ', place: '  X  ' }))
    expect(quotation.customerName).toBe('Ramesh')
    expect(quotation.place).toBe('X')
  })
})

describe('validateQuotation', () => {
  it('accepts a complete quotation', () => {
    expect(validateQuotation(input()).ok).toBe(true)
  })

  it('requires a number, customer and valid date', () => {
    const result = validateQuotation(
      input({ quotationNumber: '', customerName: ' ', date: '05-03-2026' }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors.quotationNumber).toBeDefined()
      expect(result.fieldErrors.customerName).toBeDefined()
      expect(result.fieldErrors.date).toBeDefined()
    }
  })

  it('requires at least one item', () => {
    const result = validateQuotation(input({ items: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.items).toBeDefined()
  })

  it('requires a description and positive weight per line', () => {
    const result = validateQuotation(
      input({ items: [item({ description: '', weightKg: 0 })] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors['item.0.description']).toBeDefined()
      expect(result.fieldErrors['item.0.weightKg']).toBeDefined()
    }
  })
})

describe('whatsAppUrl', () => {
  it('prefixes a bare 10-digit Indian number with 91', () => {
    expect(whatsAppUrl('9963522888', 'hi')).toBe('https://wa.me/919963522888?text=hi')
  })

  it('keeps an already-prefixed number', () => {
    expect(whatsAppUrl('+91 99635 22888', 'hi')).toBe('https://wa.me/919963522888?text=hi')
  })

  it('strips punctuation from the number and encodes the message', () => {
    expect(whatsAppUrl('99635-22888', 'a b')).toBe('https://wa.me/919963522888?text=a%20b')
  })
})

describe('quotationWhatsAppMessage', () => {
  it('includes the number, customer and grand total', () => {
    const message = quotationWhatsAppMessage({
      id: 'q1',
      ...buildQuotation(input()),
      createdAt: 1,
    })
    expect(message).toContain('PIT/0001')
    expect(message).toContain('Ramesh Traders')
    expect(message).toContain('8000')
  })
})
