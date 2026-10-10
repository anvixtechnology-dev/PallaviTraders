import { describe, expect, it } from 'vitest'

import { amountInWords } from './words'

describe('amountInWords', () => {
  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only')
  })

  it('handles single digits and teens', () => {
    expect(amountInWords(5)).toBe('Rupees Five Only')
    expect(amountInWords(17)).toBe('Rupees Seventeen Only')
  })

  it('handles tens and hundreds', () => {
    expect(amountInWords(42)).toBe('Rupees Forty Two Only')
    expect(amountInWords(100)).toBe('Rupees One Hundred Only')
    expect(amountInWords(365)).toBe('Rupees Three Hundred Sixty Five Only')
  })

  it('uses the Indian thousand/lakh/crore grouping', () => {
    expect(amountInWords(1000)).toBe('Rupees One Thousand Only')
    expect(amountInWords(25000)).toBe('Rupees Twenty Five Thousand Only')
    expect(amountInWords(100000)).toBe('Rupees One Lakh Only')
    expect(amountInWords(123456)).toBe('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only')
    expect(amountInWords(10000000)).toBe('Rupees One Crore Only')
  })

  it('includes paise', () => {
    expect(amountInWords(1234.5)).toBe('Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only')
  })

  it('rounds to whole rupees when paise would reach 100', () => {
    expect(amountInWords(10.999)).toBe('Rupees Eleven Only')
  })

  it('treats invalid input as zero', () => {
    expect(amountInWords(Number.NaN)).toBe('Rupees Zero Only')
    expect(amountInWords(-50)).toBe('Rupees Zero Only')
  })
})
