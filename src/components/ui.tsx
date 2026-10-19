/**
 * Small presentational primitives shared by the three screens.
 *
 * Deliberately plain: system fonts, one accent colour, no transitions beyond a
 * colour change on hover.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

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
 * value. The open list is drawn in-app (not a native `<datalist>` popup) so it
 * always follows the form's light theme: white background, dark text, a subtle
 * border and no heavy shadow. Typed input is never forced to match an option,
 * so custom sizes are preserved.
 *
 * Styled like {@link Select} — same control height, padding, border and a
 * chevron on the right — so it lines up with the rest of the form.
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
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [openAbove, setOpenAbove] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const listId = id ? `${id}-list` : undefined
  const trimmed = value.trim()

  // Show every option until the text stops matching one, then filter by it.
  const filtered = useMemo(() => {
    if (!trimmed || options.some((option) => option.value === trimmed)) return options
    const query = trimmed.toLowerCase()
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    )
  }, [options, trimmed])

  // Close when clicking outside the control.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Open downwards, flipping up only when there is not enough room below.
  useEffect(() => {
    if (!open) return
    function reposition() {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      setOpenAbove(below < 200 && above > below)
    }
    reposition()
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [open])

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function choose(option: { value: string; label: string }) {
    onChange(option.value)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveIndex(event.key === 'ArrowDown' ? 0 : filtered.length - 1)
        return
      }
      setActiveIndex((current) => {
        const count = filtered.length
        if (count === 0) return -1
        const step = event.key === 'ArrowDown' ? 1 : -1
        return current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count
      })
      return
    }
    if (event.key === 'Enter') {
      if (!open) return
      event.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) choose(filtered[activeIndex])
      else setOpen(false)
      return
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
      return
    }
    if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(-1)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`${controlClass} pr-9 ${invalid ? 'border-red-400' : ''}`}
      />
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

      {open && !disabled ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 z-30 max-h-56 overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border border-stone-200 bg-white py-1 shadow-sm ${
            openAbove ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          }`}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">No matching size</li>
          ) : (
            filtered.map((option, index) => {
              const selected = option.value === value
              const active = index === activeIndex
              return (
                <li
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={`cursor-pointer px-3 py-2.5 text-sm text-stone-900 ${
                    active ? 'bg-stone-100' : ''
                  } ${selected ? 'font-medium' : ''}`}
                >
                  {option.label}
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
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
