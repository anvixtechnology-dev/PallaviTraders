/**
 * A blocking confirmation dialog for destructive actions.
 *
 * Follows the same plain overlay pattern as the sale dialog: clicking the
 * backdrop cancels, but never while an operation is in flight, so a slow
 * network call cannot be dismissed by accident.
 */

import type { ReactNode } from 'react'

import { Button } from '@/components/ui'

export function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>

        <div className="px-5 py-4 text-sm text-slate-700">
          <p>{message}</p>
          {children}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
