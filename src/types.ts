/**
 * Domain types for PALLAVI IRON TRADERS.
 *
 * Stock is a set of item documents read from Firestore (there is no stock UI —
 * the shop manages them directly in the Firebase console). A sale stores a
 * snapshot of the items, quantities and sale-time prices, so history never
 * changes even if stock prices change later. Money is stored as a plain rupee
 * number rounded to 2 decimals (integer paise are used internally while
 * calculating). Business dates are `YYYY-MM-DD` strings.
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

/** One stock item, read from the `stock` collection. Managed in Firebase. */
export interface StockItem {
  id: string
  category: Category
  name: string
  quantity: number
  price: number
}

/** A line of the sale form before it is validated and saved. */
export interface SaleLineInput {
  stockItemId: string
  quantity: number
  pricePerUnit: number
}

/** A line of a saved sale, with the item details snapshotted at sale time. */
export interface SaleItem {
  stockItemId: string
  category: Category
  itemName: string
  quantity: number
  pricePerUnit: number
  total: number
}

/** Command payload: sale form -> service layer. */
export interface SaleInput {
  customerName: string
  dsNumber: string
  date: string
  items: SaleLineInput[]
  amountPaid: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
}

/**
 * One saved sale. This is both the customer transaction and the stock movement;
 * the customer's own record is folded out of these documents.
 */
export interface Sale {
  id: string
  customerName: string
  /** Normalised lowercase name, used for searching and grouping. */
  nameKey: string
  dsNumber: string
  /** Business date, `YYYY-MM-DD`. */
  date: string
  items: SaleItem[]
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  createdAt: number
}

/**
 * A lightweight customer record kept in the `customers` collection, keyed on
 * the normalised name, updated whenever that customer buys something.
 */
export interface CustomerRecord {
  id: string
  name: string
  nameKey: string
  dsNumbers: string[]
  saleCount: number
  totalAmount: number
  amountPaid: number
  balanceAmount: number
  firstDate: string
  lastDate: string
  updatedAt: number
}

/** A stock line that was requested beyond what is on hand. */
export interface StockShortfall {
  stockItemId: string
  name: string
  requested: number
  available: number
}

/* ------------------------------------------------------------------ *
 * Quotations                                                        *
 * ------------------------------------------------------------------ */

/** The three item categories a quotation line can belong to. */
export const ITEM_CATEGORIES = ['pipes', 'sheets', 'hardware'] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  pipes: 'Pipes',
  sheets: 'Sheets',
  hardware: 'Hardware',
}

export const PIPE_TYPES = ['round', 'box'] as const
export type PipeType = (typeof PIPE_TYPES)[number]

export const PIPE_TYPE_LABELS: Record<PipeType, string> = {
  round: 'Round Pipe',
  box: 'Box Pipe',
}

/** A pipe line. Items are identified by type and size. */
export interface PipeItemInput {
  category: 'pipes'
  pipeType: PipeType
  /** Nominal size (round) or dimensions (box), e.g. `1/2"` or `40 × 20 mm`. */
  size: string
  weightPerPipeKg: number
  quantity: number
  ratePerKg: number
}

/** A roofing sheet line, identified by length. */
export interface SheetItemInput {
  category: 'sheets'
  lengthFt: number
  weightPerFootKg: number
  quantity: number
  ratePerKg: number
}

/** A hardware line, priced per piece rather than per kg. */
export interface HardwareItemInput {
  category: 'hardware'
  description: string
  pieces: number
  ratePerPiece: number
}

/** One line of a quotation before it is validated and stored. */
export type QuotationItemInput = PipeItemInput | SheetItemInput | HardwareItemInput

/** A pipe line as stored, with its calculated total weight and amount. */
export interface PipeItem extends PipeItemInput {
  totalWeightKg: number
  amount: number
}
/** A sheet line as stored, with its calculated total weight and amount. */
export interface SheetItem extends SheetItemInput {
  totalWeightKg: number
  amount: number
}
/** A hardware line as stored, with its calculated amount. */
export interface HardwareItem extends HardwareItemInput {
  amount: number
}
export type QuotationItem = PipeItem | SheetItem | HardwareItem

/** Category subtotals plus the grand total. */
export interface QuotationTotals {
  pipesTotal: number
  sheetsTotal: number
  hardwareTotal: number
  grandTotal: number
}

/** Command payload: quotation form -> service layer. */
export interface QuotationInput {
  quotationNumber: string
  customerName: string
  /** Optional customer GST number; separate from the shop's fixed GSTIN. */
  customerGstNumber: string
  referenceNumber: string
  place: string
  date: string
  items: QuotationItemInput[]
}

/**
 * A generated quotation. Quotations never touch stock — they are commercial
 * offers, not sales.
 */
export interface Quotation extends QuotationTotals {
  id: string
  quotationNumber: string
  customerName: string
  /** Optional customer GST number; never overwrites the shop's fixed GSTIN. */
  customerGstNumber: string
  referenceNumber: string
  place: string
  date: string
  items: QuotationItem[]
  amountInWords: string
  createdAt: number
  updatedAt: number
}
