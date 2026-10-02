/**
 * Purchase form.
 *
 * The admin enters the customer, picks which of the three items are being sold
 * with a quantity and price, and the totals, balance and payment status are all
 * worked out automatically. Saving stores the record and reduces stock in one
 * atomic step.
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
  type PurchaseInput,
  type PurchaseItemInput,
} from '@/types'
import { balanceFor, derivePaymentStatus, grandTotal, itemTotal } from '@/lib/totals'
import { formatMoney, parseNumericInput } from '@/lib/money'
import { today } from '@/lib/dates'
import { InsufficientStockError, toErrorMessage, toFieldErrors } from '@/lib/errors'
import { useStock } from '@/hooks/useStock'
import { createPurchase } from '@/services/purchases.service'
import { PageHeading } from '@/components/Layout'
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

interface RowState {
  enabled: boolean
  quantity: string
  pricePerUnit: string
}

const emptyForm = {
  customerName: '',
  dsNumber: '',
  date: today(),
  amountPaid: '',
  paymentMethod: 'cash' as PaymentMethod,
}

export function FormPage() {
  const { stock } = useStock()

  const [customerName, setCustomerName] = useState(emptyForm.customerName)
  const [dsNumber, setDsNumber] = useState(emptyForm.dsNumber)
  const [date, setDate] = useState(emptyForm.date)
  const [amountPaidText, setAmountPaidText] = useState(emptyForm.amountPaid)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(emptyForm.paymentMethod)
  const [statusOverride, setStatusOverride] = useState<{
    status: PaymentStatus
    total: number
    amountPaid: number
  } | null>(null)
  const [rows, setRows] = useState<Record<Category, RowState>>({
    pipes: { enabled: false, quantity: '', pricePerUnit: '' },
    sheets: { enabled: false, quantity: '', pricePerUnit: '' },
    hardware: { enabled: false, quantity: '', pricePerUnit: '' },
  })

  const [saving, setSaving] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const items: PurchaseItemInput[] = useMemo(
    () =>
      CATEGORIES.filter((category) => rows[category].enabled).map((category) => ({
        category,
        quantity: parseNumericInput(rows[category].quantity),
        pricePerUnit: parseNumericInput(rows[category].pricePerUnit),
      })),
    [rows],
  )

  const total = grandTotal(items)
  const amountPaid = parseNumericInput(amountPaidText)
  const balance = balanceFor(total, amountPaid)

  // The status normally just reflects what has been paid. A manual choice sticks
  // only while the grand total and amount paid stay as they were when it was made.
  const autoStatus = derivePaymentStatus(total, amountPaid)
  const paymentStatus =
    statusOverride && statusOverride.total === total && statusOverride.amountPaid === amountPaid
      ? statusOverride.status
      : autoStatus

  function updateRow(category: Category, patch: Partial<RowState>) {
    setSavedName(null)
    setRows((current) => ({ ...current, [category]: { ...current[category], ...patch } }))
  }

  function handleStatusChange(next: PaymentStatus) {
    // Fill in what the chosen status implies so the record stays consistent.
    setStatusOverride({ status: next, total, amountPaid })
    if (next === 'paid') setAmountPaidText(total > 0 ? String(total) : '')
    if (next === 'unpaid') setAmountPaidText('')
  }

  function resetForm() {
    setCustomerName(emptyForm.customerName)
    setDsNumber(emptyForm.dsNumber)
    setDate(emptyForm.date)
    setAmountPaidText(emptyForm.amountPaid)
    setPaymentMethod(emptyForm.paymentMethod)
    setStatusOverride(null)
    setRows({
      pipes: { enabled: false, quantity: '', pricePerUnit: '' },
      sheets: { enabled: false, quantity: '', pricePerUnit: '' },
      hardware: { enabled: false, quantity: '', pricePerUnit: '' },
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    setFieldErrors({})
    setSavedName(null)

    const input: PurchaseInput = {
      customerName,
      dsNumber,
      date,
      items,
      amountPaid,
      paymentStatus,
      paymentMethod,
    }

    try {
      const result = await createPurchase(input)
      setSavedName(result.purchase.customerName)
      resetForm()
    } catch (error) {
      setFieldErrors(toFieldErrors(error))

      if (error instanceof InsufficientStockError) {
        setFormError(error.message)
      } else {
        setFormError(toErrorMessage(error, 'Could not save this purchase. Please try again.'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading title="New Customer Purchase" />

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
          <CardTitle>Items Purchased</CardTitle>
          <div className="flex flex-col gap-4">
            {CATEGORIES.map((category) => {
              const row = rows[category]
              const quantity = parseNumericInput(row.quantity)
              const overStock = row.enabled && quantity > stock[category]
              const lineTotal = itemTotal(quantity, parseNumericInput(row.pricePerUnit))

              return (
                <div
                  key={category}
                  className={`rounded-md border p-3 ${row.enabled ? 'border-slate-300 bg-slate-50/60' : 'border-slate-200'}`}
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateRow(category, { enabled: event.target.checked })}
                      className="size-4 rounded border-slate-300"
                    />
                    {CATEGORY_LABELS[category]}
                    <span className="text-xs font-normal text-slate-500">
                      ({stock[category]} in stock)
                    </span>
                  </label>

                  {row.enabled ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Field
                        label="Quantity"
                        htmlFor={`qty-${category}`}
                        error={fieldErrors[`item.${category}.quantity`]}
                      >
                        <NumberInput
                          id={`qty-${category}`}
                          value={row.quantity}
                          onChange={(value) => updateRow(category, { quantity: value })}
                          placeholder="0"
                          step={1}
                          invalid={Boolean(fieldErrors[`item.${category}.quantity`])}
                        />
                      </Field>

                      <Field
                        label="Price per item"
                        htmlFor={`price-${category}`}
                        error={fieldErrors[`item.${category}.pricePerUnit`]}
                      >
                        <NumberInput
                          id={`price-${category}`}
                          value={row.pricePerUnit}
                          onChange={(value) => updateRow(category, { pricePerUnit: value })}
                          placeholder="0.00"
                          step={0.01}
                          suffix="₹"
                          invalid={Boolean(fieldErrors[`item.${category}.pricePerUnit`])}
                        />
                      </Field>

                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-slate-700">Total</span>
                        <p className="tabular-nums rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                          {formatMoney(lineTotal)}
                        </p>
                        {overStock ? (
                          <p className="text-xs text-red-600">
                            Only {stock[category]} in stock.
                          </p>
                        ) : null}
                      </div>
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
            <span className="tabular-nums text-xl font-bold text-slate-900">
              {formatMoney(total)}
            </span>
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
            Saved {savedName}.{' '}
            <Link to="/customers" className="font-semibold underline">
              View in Customers
            </Link>
          </Banner>
        ) : null}

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Purchase'}
          </Button>
        </div>
      </form>
    </>
  )
}
