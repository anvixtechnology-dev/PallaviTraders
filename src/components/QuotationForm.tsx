/**
 * Quotation form (the "Form" page, Quotation tab).
 *
 * A quotation is a commercial offer, not a sale, so saving one never touches
 * stock. The admin enters the customer and the line items (weight x rate per
 * kg); the amounts, grand total and amount-in-words are calculated live, and the
 * quotation can be previewed and printed to A4 PDF.
 */

import { useMemo, useState } from 'react'

import type { Quotation, QuotationInput, QuotationItemInput } from '@/types'
import {
  BUSINESS,
  buildQuotation,
  quotationGrandTotal,
  quotationItemAmount,
  validateQuotation,
} from '@/lib/quotations'
import { amountInWords } from '@/lib/words'
import { formatMoney, parseNumericInput } from '@/lib/money'
import { today } from '@/lib/dates'
import { toErrorMessage, toFieldErrors } from '@/lib/errors'
import { useQuotations } from '@/hooks/useQuotations'
import { createQuotation, suggestQuotationNumber } from '@/services/quotations.service'
import { QuotationPreview } from '@/components/QuotationPreview'
import {
  Banner,
  Button,
  Card,
  CardTitle,
  Field,
  NumberInput,
  TextInput,
} from '@/components/ui'

interface LineState {
  key: number
  description: string
  size: string
  quantity: string
  thickness: string
  weightKg: string
  ratePerKg: string
}

let lineCounter = 0

function newLine(): LineState {
  return {
    key: lineCounter++,
    description: '',
    size: '',
    quantity: '',
    thickness: '',
    weightKg: '',
    ratePerKg: '',
  }
}

export function QuotationForm() {
  const { quotations } = useQuotations()

  const [quotationNumber, setQuotationNumber] = useState('')
  const [numberTouched, setNumberTouched] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(today())
  const [whatsAppPhone, setWhatsAppPhone] = useState('91')
  const [lines, setLines] = useState<LineState[]>([newLine()])

  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Quotation | null>(null)

  // The suggested number is derived, not stored, so it updates as quotations
  // load — unless the admin has typed their own number.
  const suggestedNumber = useMemo(() => suggestQuotationNumber(quotations), [quotations])
  const effectiveNumber = numberTouched ? quotationNumber : suggestedNumber

  const items: QuotationItemInput[] = useMemo(
    () =>
      lines.map((line) => ({
        description: line.description,
        size: line.size,
        quantity: parseNumericInput(line.quantity),
        thickness: line.thickness,
        weightKg: parseNumericInput(line.weightKg),
        ratePerKg: parseNumericInput(line.ratePerKg),
      })),
    [lines],
  )

  const grandTotal = quotationGrandTotal(items)

  function updateLine(key: number, patch: Partial<LineState>) {
    setSavedMessage(null)
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function resetForm() {
    setQuotationNumber('')
    setNumberTouched(false)
    setCustomerName('')
    setReferenceNumber('')
    setPlace('')
    setDate(today())
    setLines([newLine()])
  }

  async function buildAndMaybeSave(save: boolean) {
    setSaving(save)
    setFormError(null)
    setFieldErrors({})
    setSavedMessage(null)

    const input: QuotationInput = {
      quotationNumber: effectiveNumber,
      customerName,
      referenceNumber,
      place,
      date,
      items,
    }

    const validation = validateQuotation(input)
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      setFormError(validation.message)
      setSaving(false)
      return
    }

    if (!save) {
      setPreview({ id: 'preview', ...buildQuotation(validation.data), createdAt: Date.now() })
      setSaving(false)
      return
    }

    try {
      const saved = await createQuotation(input)
      setPreview(saved)
      setSavedMessage(`Quotation ${saved.quotationNumber} saved.`)
      resetForm()
    } catch (error) {
      setFieldErrors(toFieldErrors(error))
      setFormError(toErrorMessage(error, 'Could not save this quotation. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void buildAndMaybeSave(true)
        }}
        className="flex flex-col gap-5"
      >
        <Card className="p-5">
          <CardTitle>Quotation Details</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quotation Number" htmlFor="quotationNumber" error={fieldErrors.quotationNumber}>
              <TextInput
                id="quotationNumber"
                value={effectiveNumber}
                onChange={(value) => {
                  setNumberTouched(true)
                  setQuotationNumber(value)
                }}
                placeholder="PIT/0001"
                invalid={Boolean(fieldErrors.quotationNumber)}
              />
            </Field>

            <Field label="Customer Name" htmlFor="qCustomerName" error={fieldErrors.customerName}>
              <TextInput
                id="qCustomerName"
                value={customerName}
                onChange={setCustomerName}
                placeholder="e.g. Ramesh Traders"
                invalid={Boolean(fieldErrors.customerName)}
              />
            </Field>

            <Field label="Reference Number" htmlFor="referenceNumber">
              <TextInput
                id="referenceNumber"
                value={referenceNumber}
                onChange={setReferenceNumber}
                placeholder="Optional"
              />
            </Field>

            <Field label="Place" htmlFor="place">
              <TextInput
                id="place"
                value={place}
                onChange={setPlace}
                placeholder="e.g. Bhimavaram"
              />
            </Field>

            <Field label="Date" htmlFor="qDate" error={fieldErrors.date}>
              <TextInput
                id="qDate"
                type="date"
                value={date}
                onChange={setDate}
                invalid={Boolean(fieldErrors.date)}
              />
            </Field>

            <Field
              label="WhatsApp Number"
              htmlFor="whatsAppPhone"
              hint="Used only for the Send on WhatsApp button. Defaults to +91."
            >
              <TextInput
                id="whatsAppPhone"
                value={whatsAppPhone}
                onChange={setWhatsAppPhone}
                placeholder="919963522888"
              />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button variant="secondary" onClick={() => setLines((current) => [...current, newLine()])}>
              + Add Item
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {lines.map((line, index) => {
              const amount = quotationItemAmount(items[index])
              return (
                <div key={line.key} className="rounded-md border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      label="Description"
                      htmlFor={`description-${line.key}`}
                      error={fieldErrors[`item.${index}.description`]}
                    >
                      <TextInput
                        id={`description-${line.key}`}
                        value={line.description}
                        onChange={(value) => updateLine(line.key, { description: value })}
                        placeholder="e.g. GI Pipe"
                        invalid={Boolean(fieldErrors[`item.${index}.description`])}
                      />
                    </Field>

                    <Field label="Size" htmlFor={`size-${line.key}`}>
                      <TextInput
                        id={`size-${line.key}`}
                        value={line.size}
                        onChange={(value) => updateLine(line.key, { size: value })}
                        placeholder="e.g. 2 inch"
                      />
                    </Field>

                    <Field label="Thickness" htmlFor={`thickness-${line.key}`}>
                      <TextInput
                        id={`thickness-${line.key}`}
                        value={line.thickness}
                        onChange={(value) => updateLine(line.key, { thickness: value })}
                        placeholder="e.g. 3 mm"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <Field label="Qty" htmlFor={`quantity-${line.key}`}>
                      <NumberInput
                        id={`quantity-${line.key}`}
                        value={line.quantity}
                        onChange={(value) => updateLine(line.key, { quantity: value })}
                        placeholder="0"
                        step={1}
                      />
                    </Field>

                    <Field
                      label="Weight (Kg)"
                      htmlFor={`weight-${line.key}`}
                      error={fieldErrors[`item.${index}.weightKg`]}
                    >
                      <NumberInput
                        id={`weight-${line.key}`}
                        value={line.weightKg}
                        onChange={(value) => updateLine(line.key, { weightKg: value })}
                        placeholder="0.00"
                        step={0.01}
                        suffix="kg"
                        invalid={Boolean(fieldErrors[`item.${index}.weightKg`])}
                      />
                    </Field>

                    <Field
                      label="Rate / Kg"
                      htmlFor={`rate-${line.key}`}
                      error={fieldErrors[`item.${index}.ratePerKg`]}
                    >
                      <NumberInput
                        id={`rate-${line.key}`}
                        value={line.ratePerKg}
                        onChange={(value) => updateLine(line.key, { ratePerKg: value })}
                        placeholder="0.00"
                        step={0.01}
                        suffix="₹"
                        invalid={Boolean(fieldErrors[`item.${index}.ratePerKg`])}
                      />
                    </Field>

                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Amount</span>
                      <p className="tabular-nums rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                        {formatMoney(amount)}
                      </p>
                    </div>
                  </div>

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

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-700">Grand Total</span>
              <span className="tabular-nums text-xl font-bold text-slate-900">
                {formatMoney(grandTotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{amountInWords(grandTotal)}</p>
            <p className="mt-1 text-xs text-slate-500">{BUSINESS.gstNote}</p>
          </div>
        </Card>

        {formError ? <Banner tone="error">{formError}</Banner> : null}
        {savedMessage ? <Banner tone="success">{savedMessage}</Banner> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Quotation'}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => void buildAndMaybeSave(false)}>
            Preview / Print
          </Button>
        </div>
      </form>

      {preview ? (
        <QuotationPreview
          quotation={preview}
          whatsAppPhone={whatsAppPhone}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  )
}
