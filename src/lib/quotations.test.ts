import { describe, expect, it } from 'vitest'

import type {
  HardwareItemInput,
  PipeItemInput,
  QuotationInput,
  SheetItemInput,
} from '@/types'
import {
  BOX_PIPE_SIZES,
  BUSINESS,
  EMPTY_CELL,
  GSTIN,
  ROUND_PIPE_SIZES,
  SHEET_LENGTHS,
  buildQuotation,
  computeTotals,
  findRoundPipeSize,
  hardwareAmount,
  pipeAmount,
  pipeTotalWeight,
  quotationPdfFileName,
  quotationTableRows,
  quotationWhatsAppMessage,
  sheetAmount,
  sheetTotalWeight,
  validateQuotation,
  whatsAppUrl,
} from './quotations'

function pipe(overrides: Partial<PipeItemInput> = {}): PipeItemInput {
  return {
    category: 'pipes',
    pipeType: 'round',
    size: '1/2"',
    weightPerPipeKg: 10,
    quantity: 10,
    ratePerKg: 86,
    ...overrides,
  }
}

function sheet(overrides: Partial<SheetItemInput> = {}): SheetItemInput {
  return {
    category: 'sheets',
    lengthFt: 10,
    weightPerFootKg: 1.25,
    quantity: 1,
    ratePerKg: 86,
    ...overrides,
  }
}

function hardware(overrides: Partial<HardwareItemInput> = {}): HardwareItemInput {
  return {
    category: 'hardware',
    description: 'Nails',
    pieces: 10,
    ratePerPiece: 10,
    ...overrides,
  }
}

function input(overrides: Partial<QuotationInput> = {}): QuotationInput {
  return {
    quotationNumber: 'PIT/0001',
    customerName: 'Ramesh Traders',
    customerGstNumber: '',
    referenceNumber: 'REF-1',
    place: 'Bhimavaram',
    date: '2026-03-05',
    items: [pipe()],
    ...overrides,
  }
}

describe('fixed business details', () => {
  it('uses the shop GSTIN and never the customer one', () => {
    expect(GSTIN).toBe('37BPXPS5746G1ZY')
    expect(BUSINESS.gstin).toBe(GSTIN)
    expect(BUSINESS.name).toBe('PALLAVI IRON TRADERS')
    expect(BUSINESS.proprietors).toBe('Merugu Srinivas / Vaida Satish')
  })
})

describe('reference tables', () => {
  it('exposes the round pipe sizes with ODs and ranges', () => {
    expect(ROUND_PIPE_SIZES).toHaveLength(12)
    expect(findRoundPipeSize('1/2"')).toMatchObject({ odMm: 20, minWallMm: 0.8, maxWallMm: 2.1 })
    expect(findRoundPipeSize('8"')).toMatchObject({ odMm: 219 })
    expect(findRoundPipeSize('nope')).toBeUndefined()
  })

  it('has box pipe sizes', () => {
    expect(BOX_PIPE_SIZES).toContain('40 × 20 mm')
    expect(BOX_PIPE_SIZES).toContain('100 × 100 mm')
  })

  it('covers 2 ft to 30 ft in 0.5 ft steps', () => {
    expect(SHEET_LENGTHS[0]).toBe(2)
    expect(SHEET_LENGTHS[SHEET_LENGTHS.length - 1]).toBe(30)
    expect(SHEET_LENGTHS).toHaveLength(57)
    expect(SHEET_LENGTHS).toContain(10.5)
  })
})

describe('pipe calculations', () => {
  it('total weight = weight per pipe x quantity', () => {
    expect(pipeTotalWeight(pipe())).toBe(100)
  })

  it('amount = total weight x rate per kg', () => {
    expect(pipeAmount(pipe())).toBe(8600)
  })
})

describe('sheet calculations', () => {
  it('total weight = length x weight per foot', () => {
    expect(sheetTotalWeight(sheet())).toBe(12.5)
  })

  it('amount = total weight x rate', () => {
    expect(sheetAmount(sheet())).toBe(1075)
  })

  it('multiplies by quantity', () => {
    const multiple = sheet({ quantity: 4 })
    expect(sheetTotalWeight(multiple)).toBe(50)
    expect(sheetAmount(multiple)).toBe(4300)
  })
})

describe('hardware calculations', () => {
  it('amount = pieces x rate per piece', () => {
    expect(hardwareAmount(hardware())).toBe(100)
  })
})

describe('computeTotals', () => {
  it('sums each category and the grand total', () => {
    const totals = computeTotals([pipe(), sheet(), hardware()])
    expect(totals.pipesTotal).toBe(8600)
    expect(totals.sheetsTotal).toBe(1075)
    expect(totals.hardwareTotal).toBe(100)
    expect(totals.grandTotal).toBe(9775)
  })

  it('is all zeros without items', () => {
    expect(computeTotals([])).toEqual({
      pipesTotal: 0,
      sheetsTotal: 0,
      hardwareTotal: 0,
      grandTotal: 0,
    })
  })
})

describe('buildQuotation', () => {
  it('calculates line totals, category totals and words', () => {
    const quotation = buildQuotation(input({ items: [pipe(), sheet(), hardware()] }))
    expect(quotation.items[0]).toMatchObject({ totalWeightKg: 100, amount: 8600 })
    expect(quotation.grandTotal).toBe(9775)
    expect(quotation.amountInWords).toBe('Rupees Nine Thousand Seven Hundred Seventy Five Only')
  })

  it('keeps the optional customer GST number separate from the shop GSTIN', () => {
    const quotation = buildQuotation(input({ customerGstNumber: '37ABCDE1234F1Z5' }))
    expect(quotation.customerGstNumber).toBe('37ABCDE1234F1Z5')
    expect(quotation.customerGstNumber).not.toBe(GSTIN)
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

  it('accepts a quotation with no customer GST number', () => {
    expect(validateQuotation(input({ customerGstNumber: '' })).ok).toBe(true)
  })

  it('rejects a customer GST number with punctuation', () => {
    const result = validateQuotation(input({ customerGstNumber: '37-ABCDE' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.customerGstNumber).toBeDefined()
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

  it('rejects negative quantities and rates', () => {
    const result = validateQuotation(
      input({ items: [pipe({ quantity: -1, ratePerKg: -5 })] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors['item.0.quantity']).toBeDefined()
      expect(result.fieldErrors['item.0.ratePerKg']).toBeDefined()
    }
  })

  it('requires a length and weight per foot for a sheet', () => {
    const result = validateQuotation(input({ items: [sheet({ weightPerFootKg: 0 })] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors['item.0.weightPerFootKg']).toBeDefined()
  })

  it('requires a sheet quantity', () => {
    const result = validateQuotation(input({ items: [sheet({ quantity: 0 })] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors['item.0.quantity']).toBeDefined()
  })

  it('requires hardware pieces', () => {
    const result = validateQuotation(input({ items: [hardware({ pieces: 0 })] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors['item.0.pieces']).toBeDefined()
  })

  it('requires a hardware description but not for pipes or sheets', () => {
    const hardwareResult = validateQuotation(input({ items: [hardware({ description: '  ' })] }))
    expect(hardwareResult.ok).toBe(false)
    if (!hardwareResult.ok) {
      expect(hardwareResult.fieldErrors['item.0.description']).toBeDefined()
    }

    const pipesResult = validateQuotation(input({ items: [pipe(), sheet()] }))
    expect(pipesResult.ok).toBe(true)
  })
})

describe('whatsAppUrl', () => {
  it('prefixes a bare 10-digit Indian number with 91', () => {
    expect(whatsAppUrl('9963522888', 'hi')).toBe('https://wa.me/919963522888?text=hi')
  })

  it('keeps an already-prefixed number', () => {
    expect(whatsAppUrl('+91 99635 22888', 'hi')).toBe('https://wa.me/919963522888?text=hi')
  })

  it('strips punctuation and encodes the message', () => {
    expect(whatsAppUrl('99635-22888', 'a b')).toBe('https://wa.me/919963522888?text=a%20b')
  })
})

describe('quotationWhatsAppMessage', () => {
  it('includes the number, customer and grand total', () => {
    const message = quotationWhatsAppMessage({
      id: 'q1',
      ...buildQuotation(input()),
      createdAt: 1,
      updatedAt: 1,
    })
    expect(message).toContain('PALLAVI IRON TRADERS')
    expect(message).toContain('PIT/0001')
    expect(message).toContain('Ramesh Traders')
    expect(message).toContain('8,600.00')
  })
})

describe('quotationTableRows', () => {
  const rowsFor = (items: QuotationInput['items']) =>
    quotationTableRows({ id: 'q1', ...buildQuotation(input({ items })), createdAt: 1, updatedAt: 1 })

  it('renders a pipes-only quotation in the unified columns', () => {
    expect(rowsFor([pipe()])).toEqual([
      ['1', 'Pipes', 'Round Pipe', '1/2"', EMPTY_CELL, '100.00', '10', '86.00', '8,600.00'],
    ])
  })

  it('renders a sheets-only quotation in the unified columns', () => {
    expect(rowsFor([sheet()])).toEqual([
      ['1', 'Sheets', 'Sheets', EMPTY_CELL, '10.0', '12.50', '1', '86.00', '1,075.00'],
    ])
  })

  it('renders a hardware-only quotation in the unified columns', () => {
    expect(rowsFor([hardware()])).toEqual([
      ['1', 'Hardware', 'Nails', EMPTY_CELL, EMPTY_CELL, EMPTY_CELL, '10', '10.00', '100.00'],
    ])
  })

  it('keeps entry order and continuous numbering for a mixed quotation', () => {
    const rows = rowsFor([pipe(), hardware(), sheet()])
    expect(rows.map((row) => row[0])).toEqual(['1', '2', '3'])
    expect(rows.map((row) => row[1])).toEqual(['Pipes', 'Hardware', 'Sheets'])
  })
})

describe('quotationPdfFileName', () => {
  it('sanitises the quotation number into a safe filename', () => {
    expect(quotationPdfFileName({ quotationNumber: 'PIT/0001' })).toBe('Quotation-PIT_0001.pdf')
  })

  it('falls back to "draft" when the number is empty', () => {
    expect(quotationPdfFileName({ quotationNumber: '   ' })).toBe('Quotation-draft.pdf')
  })
})
