/**
 * Money helpers.
 *
 * Arithmetic is performed in integer paise to avoid floating point drift
 * (0.1 + 0.2 problems). Values are only converted back to rupees at the edges.
 */

/** Convert a rupee value to integer paise. */
export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Convert integer paise back to a rupee value rounded to 2 decimals. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Round a rupee value to 2 decimals. */
export function roundMoney(value: number): number {
  return fromCents(toCents(value))
}

/**
 * Multiply a quantity by a unit price (quantity x price per item).
 *
 * Only the unit price is scaled into paise — the quantity is a plain multiplier
 * and must not be scaled or the result would be 100x too large.
 */
export function multiplyMoney(quantity: number, unitPrice: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0
  return fromCents(Math.round(q * toCents(unitPrice)))
}

/** Sum money values safely. */
export function sumMoney(values: readonly number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0))
}

/** Format as Indian currency, e.g. ₹1,23,456.00 */
export function formatMoney(value: number | null | undefined, fractionDigits = 2): string {
  const safe = Number.isFinite(value) ? (value as number) : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(safe)
}

/** Format without the currency symbol, for table cells that already show one. */
export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  const safe = Number.isFinite(value) ? (value as number) : 0
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(safe)
}

/**
 * Parse free-text numeric input. Tolerates currency symbols, thousands
 * separators (both `1,23,456.78` and `123,456.78`) and stray whitespace.
 */
export function parseNumericInput(raw: string): number {
  if (typeof raw !== 'string') return 0
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}
