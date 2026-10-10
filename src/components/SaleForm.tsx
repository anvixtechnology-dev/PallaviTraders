/**
 * Sale form (the "Form" page, Sale tab).
 *
 * The admin picks a category, then one of that category's stock items, types a
 * quantity and price and the line amount, grand total, balance and payment
 * status are all worked out automatically. Available stock comes from Firestore
 * and is shown read-only — there is no stock editing in the app.
 *
 * Saving stores the sale, decrements stock and updates the customer record in a
 * single atomic Firestore transaction.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CATEGORIES,
  CATEGORY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type Category,
  type PaymentMethod,
  type PaymentStatus,
  type SaleInput,
  type SaleLineInput,
  type StockItem,
} from '@/types'
import { balanceFor, derivePaymentStatus, grandTotal, itemTotal } from '@/lib/totals'
import { formatMoney, parseNumericInput } from '@/lib/money'
import { today } from '@/lib/dates'
import { InsufficientStockError, toErrorMessage, toFieldErrors } from '@/lib/errors'
import { useStockItems } from '@/hooks/useStockItems'
import { createSale } from '@/services/sales.service'
import {
  Banner,
  Button,
  Card,
  CardTitle,
  Field,
  NumberInput,
  Select,
  TextInput,
} from '@/components/ui'

interface LineState {
  key: number
  category: Category
  stockItemId: string
  quantity: string
  pricePerUnit: string
}

let lineCounter = 0

function newLine(): LineState {
  return { key: lineCounter++, category: CATEGORIES[0], stockItemId: '', quantity: '', pricePerUnit: '' }
}

export function SaleForm() {
  const { items: stockItems, loaded: stockLoaded, error: stockError } = useStockItems()

  const [customerName, setCustomerName] = useState('')
  const [dsNumber, setDsNumber] = useState('')
  const [date, setDate] = useState(today())
  const [amountPaidText, setAmountPaidText] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [statusOverride, setStatusOverride] = useState<{
    status: PaymentStatus
    total: number
    amountPaid: number
  } | null>(null)
  const [lines, setLines] = useState<LineState[]>([newLine()])

  const [saving, setSaving] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const pricedLines = useMemo(
    () =>
      lines.map((line) => ({
        quantity: parseNumericInput(line.quantity),
        pricePerUnit: parseNumericInput(line.pricePerUnit),
      })),
    [lines],
  )

  const total = grandTotal(pricedLines)
  const amountPaid = parseNumericInput(amountPaidText)
  const balance = balanceFor(total, amountPaid)

  const autoStatus = derivePaymentStatus(total, amountPaid)
  const paymentStatus =
    statusOverride && statusOverride.total === total && statusOverride.amountPaid === amountPaid
      ? statusOverride.status
      : autoStatus

  function itemsForCategory(category: Category): StockItem[] {
    return stockItems.filter((item) => item.category === category)
  }

  function updateLine(key: number, patch: Partial<LineState>) {
    setSavedName(null)
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function handleCategoryChange(key: number, category: Category) {
    updateLine(key, { category, stockItemId: '', pricePerUnit: '' })
  }

  function handleItemChange(key: number, stockItemId: string) {
    const item = stockItems.find((candidate) => candidate.id === stockItemId)
    updateLine(key, {
      stockItemId,
      pricePerUnit: item ? String(item.price) : '',
    })
  }

  function handleStatusChange(next: PaymentStatus) {
    setStatusOverride({ status: next, total, amountPaid })
    if (next === 'paid') setAmountPaidText(total > 0 ? String(total) : '')
    if (next === 'unpaid') setAmountPaidText('')
  }

  function resetForm() {
    setCustomerName('')
    setDsNumber('')
    setDate(today())
    setAmountPaidText('')
    setPaymentMethod('cash')
    setStatusOverride(null)
    setLines([newLine()])
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    setFieldErrors({})
    setSavedName(null)

    const items: SaleLineInput[] = lines.map((line) => ({
      stockItemId: line.stockItemId,
      quantity: parseNumericInput(line.quantity),
      pricePerUnit: parseNumericInput(line.pricePerUnit),
    }))

    const input: SaleInput = {
      customerName,
      dsNumber,
      date,
      items,
      amountPaid,
      paymentStatus,
      paymentMethod,
    }

    try {
      const sale = await createSale(input)
      setSavedName(sale.customerName)
      resetForm()
    } catch (error) {
      setFieldErrors(toFieldErrors(error))
      if (error instanceof InsufficientStockError) {
        setFormError(error.message)
      } else {
        setFormError(toErrorMessage(error, 'Could not save this sale. Please try again.'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card className="p-5">
        <CardTitle>Customer Details</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer Name" htmlFor="customerName" error={fieldErrors.customerName}>
            <TextInput
              id="customerName"
              value={customerName}
              onChange={setCustomerName}
              placeholder="e.g. Ramesh Traders"
              invalid={Boolean(fieldErrors.customerName)}
            />
          </Field>

          <Field label="DS Number" htmlFor="dsNumber" error={fieldErrors.dsNumber}>
            <TextInput
              id="dsNumber"
              value={dsNumber}
              onChange={setDsNumber}
              placeholder="e.g. DS-101"
              invalid={Boolean(fieldErrors.dsNumber)}
            />
          </Field>

          <Field label="Date" htmlFor="date" error={fieldErrors.date}>
            <TextInput
              id="date"
              type="date"
              value={date}
              onChange={setDate}
              invalid={Boolean(fieldErrors.date)}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Items Sold</CardTitle>
          <Button variant="secondary" onClick={() => setLines((current) => [...current, newLine()])}>
            + Add Item
          </Button>
        </div>

        {stockError ? (
          <div className="mb-4">
            <Banner tone="error">{stockError}</Banner>
          </div>
        ) : null}

        {!stockLoaded ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading stock…</p>
        ) : stockItems.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No stock items found. Add documents to the <strong>stock</strong> collection in the
            Firebase console (fields: category, name, quantity, price).
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {lines.map((line, index) => {
            const available = itemsForCategory(line.category)
            const selected = stockItems.find((item) => item.id === line.stockItemId)
            const quantity = parseNumericInput(line.quantity)
            const overStock = selected ? quantity > selected.quantity : false
            const lineTotal = itemTotal(quantity, parseNumericInput(line.pricePerUnit))

            return (
              <div key={line.key} className="rounded-md border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Category" htmlFor={`category-${line.key}`}>
                    <Select
                      id={`category-${line.key}`}
                      value={line.category}
                      onChange={(value) => handleCategoryChange(line.key, value)}
                      options={CATEGORIES.map((category) => ({
                        value: category,
                        label: CATEGORY_LABELS[category],
                      }))}
                    />
                  </Field>

                  <Field
                    label="Item"
                    htmlFor={`item-${line.key}`}
                    error={fieldErrors[`item.${index}.stockItemId`]}
                  >
                    <Select
                      id={`item-${line.key}`}
                      value={line.stockItemId}
                      onChange={(value) => handleItemChange(line.key, value)}
                      invalid={Boolean(fieldErrors[`item.${index}.stockItemId`])}
                      options={[
                        { value: '', label: available.length ? 'Select item' : 'No items in category' },
                        ...available.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">Available Stock</span>
                    <p className="tabular-nums rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                      {selected ? selected.quantity : '—'}
                    </p>
                  </div>

                  <Field
                    label="Quantity"
                    htmlFor={`qty-${line.key}`}
                    error={fieldErrors[`item.${index}.quantity`]}
                  >
                    <NumberInput
                      id={`qty-${line.key}`}
                      value={line.quantity}
                      onChange={(value) => updateLine(line.key, { quantity: value })}
                      placeholder="0"
                      step={0.01}
                      invalid={Boolean(fieldErrors[`item.${index}.quantity`]) || overStock}
                    />
                  </Field>

                  <Field
                    label="Price per unit"
                    htmlFor={`price-${line.key}`}
                    error={fieldErrors[`item.${index}.pricePerUnit`]}
                  >
                    <NumberInput
                      id={`price-${line.key}`}
                      value={line.pricePerUnit}
                      onChange={(value) => updateLine(line.key, { pricePerUnit: value })}
                      placeholder="0.00"
                      step={0.01}
                      suffix="₹"
                      invalid={Boolean(fieldErrors[`item.${index}.pricePerUnit`])}
                    />
                  </Field>

                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">Amount</span>
                    <p className="tabular-nums rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                      {formatMoney(lineTotal)}
                    </p>
                  </div>
                </div>

                {overStock ? (
                  <p className="mt-2 text-xs text-red-600">
                    Only {selected?.quantity} in stock.
                  </p>
                ) : null}

                {lines.length > 1 ? (
                  <div className="mt-3 text-right">
                    <Button
                      variant="danger"
                      onClick={() =>
                        setLines((current) => current.filter((entry) => entry.key !== line.key))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {fieldErrors.items ? (
          <p className="mt-3 text-xs text-red-600">{fieldErrors.items}</p>
        ) : null}

        <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-700">Grand Total</span>
          <span className="tabular-nums text-xl font-bold text-slate-900">{formatMoney(total)}</span>
        </div>
      </Card>

      <Card className="p-5">
        <CardTitle>Payment</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment Status" htmlFor="paymentStatus" error={fieldErrors.paymentStatus}>
            <Select
              id="paymentStatus"
              value={paymentStatus}
              onChange={handleStatusChange}
              options={PAYMENT_STATUSES.map((value) => ({
                value,
                label: PAYMENT_STATUS_LABELS[value],
              }))}
            />
          </Field>

          <Field label="Payment Method" htmlFor="paymentMethod" error={fieldErrors.paymentMethod}>
            <Select
              id="paymentMethod"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHODS.map((value) => ({
                value,
                label: PAYMENT_METHOD_LABELS[value],
              }))}
            />
          </Field>

          <Field
            label="Amount Paid"
            htmlFor="amountPaid"
            error={fieldErrors.amountPaid}
            hint="Status updates automatically as you type."
          >
            <NumberInput
              id="amountPaid"
              value={amountPaidText}
              onChange={setAmountPaidText}
              placeholder="0.00"
              step={0.01}
              suffix="₹"
              invalid={Boolean(fieldErrors.amountPaid)}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Balance</span>
            <p className="tabular-nums rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {formatMoney(balance)}
            </p>
          </div>
        </div>
      </Card>

      {formError ? <Banner tone="error">{formError}</Banner> : null}
      {savedName ? (
        <Banner tone="success">
          Saved sale for {savedName}.{' '}
          <Link to="/customers" className="font-semibold underline">
            View in Customers
          </Link>
        </Banner>
      ) : null}

      <div>
        <Button type="submit" disabled={saving || !stockLoaded}>
          {saving ? 'Saving…' : 'Save Sale'}
        </Button>
      </div>
    </form>
  )
}
