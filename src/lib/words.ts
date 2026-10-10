/**
 * Amount in words, using the Indian numbering system (crore/lakh/thousand).
 *
 * Used on the quotation for the "Amount in Words" line. Pure and dependency
 * free so it can be unit tested.
 */

const UNITS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigit(value: number): string {
  if (value < 20) return UNITS[value]
  const tens = Math.floor(value / 10)
  const units = value % 10
  return units === 0 ? TENS[tens] : `${TENS[tens]} ${UNITS[units]}`
}

function threeDigit(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const parts: string[] = []
  if (hundreds > 0) parts.push(`${UNITS[hundreds]} Hundred`)
  if (rest > 0) parts.push(twoDigit(rest))
  return parts.join(' ')
}

/** Integer rupees to words (supports up to crores). */
function integerToWords(value: number): string {
  if (value === 0) return 'Zero'

  const parts: string[] = []
  let remaining = value

  const crore = Math.floor(remaining / 10000000)
  remaining %= 10000000
  if (crore > 0) parts.push(`${integerToWords(crore)} Crore`)

  const lakh = Math.floor(remaining / 100000)
  remaining %= 100000
  if (lakh > 0) parts.push(`${twoDigit(lakh)} Lakh`)

  const thousand = Math.floor(remaining / 1000)
  remaining %= 1000
  if (thousand > 0) parts.push(`${twoDigit(thousand)} Thousand`)

  if (remaining > 0) parts.push(threeDigit(remaining))

  return parts.join(' ')
}

/** Format a rupee amount as words, e.g. `Rupees One Thousand Only`. */
export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const totalPaise = Math.round(safe * 100)
  const rupees = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100

  let words = `Rupees ${integerToWords(rupees)}`
  if (paise > 0) words += ` and ${twoDigit(paise)} Paise`
  return `${words} Only`
}
