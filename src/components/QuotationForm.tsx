/**
 * Quotation form (the "Form" page).
 *
 * A quotation is a commercial offer, not a sale, so saving one never touches
 * stock. Each line has a category (Pipes / Sheets / Hardware) that reveals only
 * the fields that category needs; weights and amounts are recalculated live.
 *
 * With an `editId`, the same form opens a saved quotation, populates every
 * field from Firestore, and saves back over the original document.
 */

import { useMemo, useRef, useState } from 'react'

import type {
  HardwareType,
  ItemCategory,
  PipeType,
  Quotation,
  QuotationInput,
  QuotationItem,
  QuotationItemInput,
} from '@/types'
import {
  HARDWARE_TYPES,
  HARDWARE_TYPE_LABELS,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  PIPE_TYPES,
  PIPE_TYPE_LABELS,
} from '@/types'
import {
  ROUND_PIPE_SIZES,
  SHEET_LENGTHS,
  buildQuotation,
  computeTotals,
  normaliseCustomerGst,
  quotationItemAmount,
  quotationItemWeight,
  GST_NOTE,
  validateQuotation,
} from '@/lib/quotations'
import { amountInWords } from '@/lib/words'
import { formatMoney, formatNumber, parseNumericInput } from '@/lib/money'
import { today } from '@/lib/dates'
import { toErrorMessage, toFieldErrors } from '@/lib/errors'
import { useQuotations } from '@/hooks/useQuotations'
import {
  createQuotation,
  suggestQuotationNumber,
  updateQuotation,
} from '@/services/quotations.service'
import { QuotationPreview } from '@/components/QuotationPreview'
import {
  Banner,
  Button,
  Card,
  CardTitle,
  Combobox,
  Field,
  NumberInput,
  Select,
  TextInput,
} from '@/components/ui'

/* ------------------------------------------------------------------ *
 * Line state                                                          *
 * ------------------------------------------------------------------ */

interface PipeLineState {
  key: number
  category: 'pipes'
  pipeType: PipeType
  size: string
  weightPerPipe: string
  quantity: string
  ratePerKg: string
}

interface SheetLineState {
  key: number
  category: 'sheets'
  lengthFt: string
  weightPerFoot: string
  quantity: string
  ratePerKg: string
}

interface HardwareLineState {
  key: number
  category: 'hardware'
  hardwareType: HardwareType
  description: string
  pieces: string
  ratePerPiece: string
  weight: string
  ratePerKg: string
}

type LineState = PipeLineState | SheetLineState | HardwareLineState

type LinePatch = Partial<Omit<PipeLineState, 'key' | 'category'>> &
  Partial<Omit<SheetLineState, 'key' | 'category'>> &
  Partial<Omit<HardwareLineState, 'key' | 'category'>>

let lineCounter = 0

function newLine(category: ItemCategory, key = lineCounter++): LineState {
  if (category === 'pipes') {
    return {
      key,
      category: 'pipes',
      pipeType: 'round',
      size: '',
      weightPerPipe: '',
      quantity: '',
      ratePerKg: '',
    }
  }
  if (category === 'sheets') {
    return {
      key,
      category: 'sheets',
      lengthFt: '10',
      weightPerFoot: '',
      quantity: '1',
      ratePerKg: '',
    }
  }
  return {
    key,
    category: 'hardware',
    hardwareType: 'none',
    description: '',
    pieces: '',
    ratePerPiece: '',
    weight: '',
    ratePerKg: '',
  }
}

function toItemInput(line: LineState): QuotationItemInput {
  if (line.category === 'pipes') {
    return {
      category: 'pipes',
      pipeType: line.pipeType,
      size: line.size,
      weightPerPipeKg: parseNumericInput(line.weightPerPipe),
      quantity: parseNumericInput(line.quantity),
      ratePerKg: parseNumericInput(line.ratePerKg),
    }
  }
  if (line.category === 'sheets') {
    return {
      category: 'sheets',
      lengthFt: parseNumericInput(line.lengthFt),
      weightPerFootKg: parseNumericInput(line.weightPerFoot),
      quantity: parseNumericInput(line.quantity),
      ratePerKg: parseNumericInput(line.ratePerKg),
    }
  }
  if (line.hardwareType === 'plate') {
    return {
      category: 'hardware',
      hardwareType: 'plate',
      description: line.description,
      weightKg: parseNumericInput(line.weight),
      ratePerKg: parseNumericInput(line.ratePerKg),
    }
  }
  return {
    category: 'hardware',
    hardwareType: 'none',
    description: line.description,
    pieces: parseNumericInput(line.pieces),
    ratePerPiece: parseNumericInput(line.ratePerPiece),
  }
}

/** Render a stored number as editable text; blank out zeroes. */
function numberToInput(value: number): string {
  return value ? String(value) : ''
}

/** Turn a saved quotation item back into editable line state. */
function itemToLine(item: QuotationItem): LineState {
  const key = lineCounter++

  if (item.category === 'pipes') {
    return {
      key,
      category: 'pipes',
      pipeType: item.pipeType,
      size: item.size,
      weightPerPipe: numberToInput(item.weightPerPipeKg),
      quantity: numberToInput(item.quantity),
      ratePerKg: numberToInput(item.ratePerKg),
    }
  }
  if (item.category === 'sheets') {
    return {
      key,
      category: 'sheets',
      lengthFt: numberToInput(item.lengthFt) || '10',
      weightPerFoot: numberToInput(item.weightPerFootKg),
      quantity: numberToInput(item.quantity) || '1',
      ratePerKg: numberToInput(item.ratePerKg),
    }
  }
  if (item.hardwareType === 'plate') {
    return {
      key,
      category: 'hardware',
      hardwareType: 'plate',
      description: item.description,
      pieces: '',
      ratePerPiece: '',
      weight: numberToInput(item.weightKg),
      ratePerKg: numberToInput(item.ratePerKg),
    }
  }
  return {
    key,
    category: 'hardware',
    hardwareType: 'none',
    description: item.description,
    pieces: numberToInput(item.pieces),
    ratePerPiece: numberToInput(item.ratePerPiece),
    weight: '',
    ratePerKg: '',
  }
}

const CATEGORY_OPTIONS = ITEM_CATEGORIES.map((value) => ({
  value,
  label: ITEM_CATEGORY_LABELS[value],
}))

const HARDWARE_TYPE_OPTIONS = HARDWARE_TYPES.map((value) => ({
  value,
  label: HARDWARE_TYPE_LABELS[value],
}))

const PIPE_TYPE_OPTIONS = PIPE_TYPES.map((value) => ({
  value,
  label: PIPE_TYPE_LABELS[value],
}))

const ROUND_SIZE_OPTIONS = ROUND_PIPE_SIZES.map((size) => ({
  value: size.nominal,
  label: size.nominal,
}))

const SHEET_LENGTH_OPTIONS = SHEET_LENGTHS.map((value) => ({
  value: String(value),
  label: `${value} ft`,
}))

/* ------------------------------------------------------------------ *
 * Form                                                                *
 * ------------------------------------------------------------------ */

export function QuotationForm({
  editId = null,
  onCancel,
}: {
  /** Firestore document id of a saved quotation to edit; null to create. */
  editId?: string | null
  /** Called by the Cancel button while editing. */
  onCancel?: () => void
}) {
  const { quotations, loaded } = useQuotations()

  const [quotationNumber, setQuotationNumber] = useState('')
  const [numberTouched, setNumberTouched] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerGstNumber, setCustomerGstNumber] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<LineState[]>([newLine('pipes')])
  const [initialised, setInitialised] = useState(false)
  const lockedId = useRef<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Quotation | null>(null)

  const suggestedNumber = useMemo(() => suggestQuotationNumber(quotations), [quotations])
  const effectiveNumber = numberTouched ? quotationNumber : suggestedNumber

  const items: QuotationItemInput[] = useMemo(() => lines.map(toItemInput), [lines])
  const totals = useMemo(() => computeTotals(items), [items])

  // Populate the form from a saved quotation when editing.
  if (editId && loaded && !initialised && lockedId.current !== editId) {
    const target = quotations.find((q) => q.id === editId)
    if (target) {
      setNumberTouched(true)
      setQuotationNumber(target.quotationNumber)
      setCustomerName(target.customerName)
      setCustomerGstNumber(target.customerGstNumber)
      setReferenceNumber(target.referenceNumber)
      setPlace(target.place)
      setDate(target.date)
      lineCounter = 0
      setLines(target.items.map(itemToLine))
      setPreview(null)
      setSavedMessage(null)
      setFormError(null)
      setFieldErrors({})
      lockedId.current = editId
      setInitialised(true)
    }
  }

  if (editId && loaded && initialised && lockedId.current !== editId) {
    lockedId.current = null
    setInitialised(false)
  }

  if (!editId && initialised) {
    lockedId.current = null
    setInitialised(false)
  }

  function updateLine(key: number, patch: LinePatch) {
    setSavedMessage(null)
    setLines((current) =>
      current.map((line) => (line.key === key ? ({ ...line, ...patch } as LineState) : line)),
    )
  }

  function changeCategory(key: number, category: ItemCategory) {
    setSavedMessage(null)
    setLines((current) =>
      current.map((line) => (line.key === key ? newLine(category, key) : line)),
    )
  }

  function removeLine(key: number) {
    setSavedMessage(null)
    setLines((current) => current.filter((line) => line.key !== key))
  }

  async function buildAndMaybeSave(save: boolean) {
    setSaving(save)
    setFormError(null)
    setFieldErrors({})
    setSavedMessage(null)

    const input: QuotationInput = {
      quotationNumber: effectiveNumber,
      customerName,
      customerGstNumber,
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
      setPreview({ id: 'preview', ...buildQuotation(validation.data), createdAt: 0, updatedAt: 0 })
      setSaving(false)
      return
    }

    try {
      if (editId) {
        const saved = await updateQuotation(editId, input)
        setPreview(saved)
        setSavedMessage(`Quotation ${saved.quotationNumber} updated.`)
      } else {
        const saved = await createQuotation(input)
        setPreview(saved)
        setSavedMessage(`Quotation ${saved.quotationNumber} saved.`)
      }
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
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field
              label="Quotation Number"
              htmlFor="quotationNumber"
              error={fieldErrors.quotationNumber}
            >
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
              label="Customer Name"
              htmlFor="qCustomerName"
              error={fieldErrors.customerName}
            >
              <TextInput
                id="qCustomerName"
                value={customerName}
                onChange={setCustomerName}
                placeholder="e.g. Ramesh Traders"
                invalid={Boolean(fieldErrors.customerName)}
              />
            </Field>

            <Field
              label="Customer GST Number"
              htmlFor="qCustomerGst"
              error={fieldErrors.customerGstNumber}
              hint="Optional. Letters and numbers only."
            >
              <TextInput
                id="qCustomerGst"
                value={customerGstNumber}
                onChange={(value) => setCustomerGstNumber(normaliseCustomerGst(value))}
                placeholder="e.g. 37ABCDE1234F1Z5"
                invalid={Boolean(fieldErrors.customerGstNumber)}
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
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="mb-0">Items</CardTitle>
            <Button
              variant="secondary"
              onClick={() => setLines((current) => [...current, newLine('pipes')])}
            >
              + Add Item
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            {lines.map((line, index) => (
              <ItemRow
                key={line.key}
                line={line}
                index={index}
                item={items[index]}
                errors={fieldErrors}
                canRemove={lines.length > 1}
                onChange={updateLine}
                onChangeCategory={changeCategory}
                onRemove={removeLine}
              />
            ))}
          </div>

          {fieldErrors.items ? (
            <p className="mt-3 text-xs text-red-600">{fieldErrors.items}</p>
          ) : null}
        </Card>

        <Card className="p-5">
          <CardTitle>Summary</CardTitle>
          <dl className="flex flex-col gap-2 text-sm">
            <SummaryLine label="Pipes Total" value={formatMoney(totals.pipesTotal)} />
            <SummaryLine label="Sheets Total" value={formatMoney(totals.sheetsTotal)} />
            <SummaryLine label="Hardware Total" value={formatMoney(totals.hardwareTotal)} />
          </dl>

          <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-stone-700">Grand Total</span>
              <span className="tabular-nums text-lg font-semibold text-stone-900 sm:text-xl">
                {formatMoney(totals.grandTotal)}
              </span>
            </div>
          </div>

          <p className="mt-3 text-sm text-stone-600">{amountInWords(totals.grandTotal)}</p>
          {GST_NOTE ? (
            <p className="mt-1 text-xs text-stone-500">{GST_NOTE}</p>
          ) : null}
        </Card>

        {formError ? <Banner tone="error">{formError}</Banner> : null}
        {savedMessage ? <Banner tone="success">{savedMessage}</Banner> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Save Changes' : 'Generate Quotation'}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => void buildAndMaybeSave(false)}>
            Preview Quotation
          </Button>
          {editId && onCancel ? (
            <Button variant="secondary" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {preview ? <QuotationPreview quotation={preview} onClose={() => setPreview(null)} /> : null}
    </>
  )
}

/** A label/value row in the form's totals summary. */
function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="tabular-nums font-medium text-stone-900">{value}</dd>
    </div>
  )
}

/**
 * A calculated, read-only value rendered like an input so it lines up with
 * the editable fields in the same grid.
 */
function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <p className="tabular-nums w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
        {value}
      </p>
    </div>
  )
}

function ItemRow({
  line,
  index,
  item,
  errors,
  canRemove,
  onChange,
  onChangeCategory,
  onRemove,
}: {
  line: LineState
  index: number
  item: QuotationItemInput
  errors: Record<string, string>
  canRemove: boolean
  onChange: (key: number, patch: LinePatch) => void
  onChangeCategory: (key: number, category: ItemCategory) => void
  onRemove: (key: number) => void
}) {
  const error = (field: string) => errors[`item.${index}.${field}`]
  const weight = quotationItemWeight(item)
  const amount = quotationItemAmount(item)

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <span className="flex h-[38px] items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700">
            Item {index + 1}
          </span>
          <div className="w-44 sm:w-52">
            <Field label="Category" htmlFor={`category-${line.key}`}>
              <Select
                id={`category-${line.key}`}
                value={line.category}
                onChange={(value) => onChangeCategory(line.key, value)}
                options={CATEGORY_OPTIONS}
              />
            </Field>
          </div>
        </div>

        {canRemove ? (
          <Button variant="danger" onClick={() => onRemove(line.key)}>
            Remove
          </Button>
        ) : null}
      </div>

      {line.category === 'pipes' ? (
        <PipesFields line={line} onChange={onChange} error={error} weight={weight} amount={amount} />
      ) : null}
      {line.category === 'sheets' ? (
        <SheetsFields line={line} onChange={onChange} error={error} weight={weight} amount={amount} />
      ) : null}
      {line.category === 'hardware' ? (
        <HardwareFields line={line} onChange={onChange} error={error} amount={amount} />
      ) : null}
    </div>
  )
}

function PipesFields({
  line,
  onChange,
  error,
  weight,
  amount,
}: {
  line: PipeLineState
  onChange: (key: number, patch: LinePatch) => void
  error: (field: string) => string | undefined
  weight: number
  amount: number
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
      <Field label="Pipe Type" htmlFor={`pipeType-${line.key}`}>
        <Select
          id={`pipeType-${line.key}`}
          value={line.pipeType}
          onChange={(value) => onChange(line.key, { pipeType: value, size: '' })}
          options={PIPE_TYPE_OPTIONS}
        />
      </Field>

      <Field
        label={line.pipeType === 'round' ? 'Pipe Size' : 'Box Pipe Size'}
        htmlFor={`size-${line.key}`}
        error={error('size')}
      >
        <Combobox
          id={`size-${line.key}`}
          value={line.size}
          onChange={(value) => onChange(line.key, { size: value })}
          options={ROUND_SIZE_OPTIONS}
          placeholder="Select pipe size"
          invalid={Boolean(error('size'))}
        />
      </Field>

      <Field
        label="Weight per Pipe (Kg)"
        htmlFor={`weightPerPipe-${line.key}`}
        error={error('weightPerPipeKg')}
      >
        <NumberInput
          id={`weightPerPipe-${line.key}`}
          value={line.weightPerPipe}
          onChange={(value) => onChange(line.key, { weightPerPipe: value })}
          placeholder="0.00"
          step={0.01}
          suffix="kg"
          invalid={Boolean(error('weightPerPipeKg'))}
        />
      </Field>

      <Field label="Quantity" htmlFor={`quantity-${line.key}`} error={error('quantity')}>
        <NumberInput
          id={`quantity-${line.key}`}
          value={line.quantity}
          onChange={(value) => onChange(line.key, { quantity: value })}
          placeholder="0"
          step={1}
          invalid={Boolean(error('quantity'))}
        />
      </Field>

      <Field label="Rate per Kg" htmlFor={`rate-${line.key}`} error={error('ratePerKg')}>
        <NumberInput
          id={`rate-${line.key}`}
          value={line.ratePerKg}
          onChange={(value) => onChange(line.key, { ratePerKg: value })}
          placeholder="0.00"
          step={0.01}
          suffix="₹"
          invalid={Boolean(error('ratePerKg'))}
        />
      </Field>

      <ComputedField label="Total Weight (Kg)" value={formatNumber(weight)} />
      <ComputedField label="Amount" value={formatMoney(amount)} />
    </div>
  )
}

function SheetsFields({
  line,
  onChange,
  error,
  weight,
  amount,
}: {
  line: SheetLineState
  onChange: (key: number, patch: LinePatch) => void
  error: (field: string) => string | undefined
  weight: number
  amount: number
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
      <Field label="Length (ft)" htmlFor={`length-${line.key}`} error={error('lengthFt')}>
        <Select
          id={`length-${line.key}`}
          value={line.lengthFt}
          onChange={(value) => onChange(line.key, { lengthFt: value })}
          options={SHEET_LENGTH_OPTIONS}
        />
      </Field>

      <Field
        label="Weight per Feet (Kg)"
        htmlFor={`weightPerFeet-${line.key}`}
        error={error('weightPerFeetKg')}
      >
        <NumberInput
          id={`weightPerFeet-${line.key}`}
          value={line.weightPerFoot}
          onChange={(value) => onChange(line.key, { weightPerFoot: value })}
          placeholder="0.00"
          step={0.01}
          suffix="kg"
          invalid={Boolean(error('weightPerFootKg'))}
        />
      </Field>

      <Field label="Quantity" htmlFor={`quantity-${line.key}`} error={error('quantity')}>
        <NumberInput
          id={`quantity-${line.key}`}
          value={line.quantity}
          onChange={(value) => onChange(line.key, { quantity: value })}
          placeholder="0"
          step={1}
          invalid={Boolean(error('quantity'))}
        />
      </Field>

      <Field label="Rate per Kg" htmlFor={`rate-${line.key}`} error={error('ratePerKg')}>
        <NumberInput
          id={`rate-${line.key}`}
          value={line.ratePerKg}
          onChange={(value) => onChange(line.key, { ratePerKg: value })}
          placeholder="0.00"
          step={0.01}
          suffix="₹"
          invalid={Boolean(error('ratePerKg'))}
        />
      </Field>

      <ComputedField label="Total Weight (Kg)" value={formatNumber(weight)} />
      <ComputedField label="Amount" value={formatMoney(amount)} />
    </div>
  )
}

function HardwareFields({
  line,
  onChange,
  error,
  amount,
}: {
  line: HardwareLineState
  onChange: (key: number, patch: LinePatch) => void
  error: (field: string) => string | undefined
  amount: number
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
      <Field label="Hardware Type" htmlFor={`hardwareType-${line.key}`}>
        <Select
          id={`hardwareType-${line.key}`}
          value={line.hardwareType}
          onChange={(value) => onChange(line.key, { hardwareType: value })}
          options={HARDWARE_TYPE_OPTIONS}
        />
      </Field>

      <div className="sm:col-span-1 md:col-span-2">
        <Field
          label="Description"
          htmlFor={`description-${line.key}`}
          error={error('description')}
        >
          <TextInput
            id={`description-${line.key}`}
            value={line.description}
            onChange={(value) => onChange(line.key, { description: value })}
            placeholder="e.g. Nails"
            invalid={Boolean(error('description'))}
          />
        </Field>
      </div>

      {line.hardwareType === 'plate' ? (
        <>
          <Field label="Weight (Kg)" htmlFor={`weight-${line.key}`} error={error('weightKg')}>
            <NumberInput
              id={`weight-${line.key}`}
              value={line.weight}
              onChange={(value) => onChange(line.key, { weight: value })}
              placeholder="0.00"
              step={0.01}
              suffix="kg"
              invalid={Boolean(error('weightKg'))}
            />
          </Field>

          <Field label="Rate per Kg" htmlFor={`hwRate-${line.key}`} error={error('ratePerKg')}>
            <NumberInput
              id={`hwRate-${line.key}`}
              value={line.ratePerKg}
              onChange={(value) => onChange(line.key, { ratePerKg: value })}
              placeholder="0.00"
              step={0.01}
              suffix="₹"
              invalid={Boolean(error('ratePerKg'))}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Number of Pieces" htmlFor={`pieces-${line.key}`} error={error('pieces')}>
            <NumberInput
              id={`pieces-${line.key}`}
              value={line.pieces}
              onChange={(value) => onChange(line.key, { pieces: value })}
              placeholder="0"
              step={1}
              invalid={Boolean(error('pieces'))}
            />
          </Field>

          <Field
            label="Rate per Piece"
            htmlFor={`ratePerPiece-${line.key}`}
            error={error('ratePerPiece')}
          >
            <NumberInput
              id={`ratePerPiece-${line.key}`}
              value={line.ratePerPiece}
              onChange={(value) => onChange(line.key, { ratePerPiece: value })}
              placeholder="0.00"
              step={0.01}
              suffix="₹"
              invalid={Boolean(error('ratePerPiece'))}
            />
          </Field>
        </>
      )}

      <ComputedField label="Amount" value={formatMoney(amount)} />
    </div>
  )
}
