/**
 * Domain types for PALLAVI TRADERS.
 *
 * The shop tracks exactly three stock categories and one purchase record per
 * customer entry. Money is stored as a plain rupee number rounded to 2 decimals
 * (integer paise are used internally while calculating). Business dates are
 * `YYYY-MM-DD` strings so sorting and filtering never depend on timezone parsing.
 */

export const CATEGORIES = ['pipes', 'sheets', 'hardware'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  pipes: 'Pipes',
  sheets: 'Sheets',
  hardware: 'Hardware',
}

export const PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partially Paid',
  unpaid: 'Unpaid',
}

export const PAYMENT_METHODS = [
  'cash',
  'upi',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'cheque',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
}

/** Current quantity on hand for each of the three categories. */
export type Stock = Record<Category, number>

export interface PurchaseItem {
  category: Category
  quantity: number
  pricePerUnit: number
  total: number
}

/**
 * One saved customer purchase. This is both the customer record and the
 * transaction: the spec treats each form submission as one entry with a DS
 * number, so they are stored together in a single `purchases` document.
 */
export interface Purchase {
  id: string
  customerName: string
  /** Normalised lowercase name, used for searching. */
  nameKey: string
  dsNumber: string
  /** Business date, `YYYY-MM-DD`. */
  date: string
  items: PurchaseItem[]
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  createdAt: number
}

/** A row of the purchase form before it is validated and saved. */
export interface PurchaseItemInput {
  category: Category
  quantity: number
  pricePerUnit: number
}

/** Command payload: purchase form -> service layer. */
export interface PurchaseInput {
  customerName: string
  dsNumber: string
  date: string
  items: PurchaseItemInput[]
  amountPaid: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
}

export interface StockShortfall {
  category: Category
  requested: number
  available: number
}
