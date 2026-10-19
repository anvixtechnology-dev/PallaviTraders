/**
 * Small presentational primitives shared by the three screens.
 *
 * Deliberately plain: system fonts, one accent colour, no transitions beyond a
 * colour change on hover.
 */

import type { ReactNode } from 'react'

import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/types'

/**
 * A plain white panel. Padding is left to the caller so a screen can opt out
 * (the customer table needs to sit flush against the card edges).
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-md border border-stone-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-base font-semibold text-stone-900 ${className || 'mb-4'}`}>{children}</h2>
}

const controlClass =
  'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-200 focus:outline-none disabled:bg-stone-50 disabled:text-stone-400'

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  invalid = false,
  autoFocus = false,
  list,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  list?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      list={list}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      className={`${controlClass} ${invalid ? 'border-red-400' : ''}`}
    />
  )
}

/**
 * An editable, searchable dropdown: pick one of `options` or type a custom
 * value. Backed by a native `<datalist>`, so the chosen/typed value is always
 * free text and is never forced to match an existing option.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  invalid = false,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
}) {
  const listId = id ? `${id}-list` : undefined

  return (
    <>
      <input
        id={id}
        type="text"
        list={listId}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${controlClass} ${invalid ? 'border-red-400' : ''}`}
      />
      {listId ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </datalist>
      ) : null}
    </>
  )
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled = false,
  invalid = false,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`${controlClass} ${invalid ? 'border-red-400' : ''}`}
    />
  )
}

export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  min = 0,
  step = 1,
  suffix,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  min?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onWheel={(event) => event.currentTarget.blur()}
        className={`${controlClass} tabular-nums ${suffix ? 'pr-12' : ''} ${invalid ? 'border-red-400' : ''}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  invalid = false,
  disabled = false,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={`${controlClass} appearance-none pr-9 ${invalid ? 'border-red-400' : ''}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-stone-400"
      >
        <path
          d="M5 7.5 10 12.5 15 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const base = `inline-flex items-center justify-center rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  }`
  const styles =
    variant === 'primary'
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : variant === 'success'
        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
        : variant === 'danger'
          ? 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
          : 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50'

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}

export function Banner({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700'

  return (
    <p role="status" className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  )
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    paid: 'border-green-200 bg-green-50 text-green-700',
    partial: 'border-amber-200 bg-amber-50 text-amber-700',
    unpaid: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-stone-500">Loading…</p>
}
