/**
 * WhatsApp share dialog.
 *
 * On phones/tablets that support the Web Share API with files, the generated
 * PDF is shared through the native share sheet so it can be sent to WhatsApp
 * with the PDF attached. Elsewhere (most desktops) it falls back to downloading
 * the PDF and opening a `wa.me` chat with the message pre-filled, since a link
 * cannot attach a file.
 */

import { useState } from 'react'

import type { Quotation } from '@/types'
import { downloadQuotationPdf, quotationPdfBlob } from '@/lib/quotation-pdf'
import {
  quotationPdfFileName,
  quotationWhatsAppMessage,
  whatsAppUrl,
} from '@/lib/quotations'
import { Button, Field, TextArea, TextInput } from '@/components/ui'

type ShareNavigator = Navigator & {
  canShare?: (data?: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
}

/** Whether the browser can share this file (so WhatsApp receives the PDF). */
function canShareFiles(file: File): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as ShareNavigator
  if (typeof nav.canShare !== 'function' || typeof nav.share !== 'function') return false
  try {
    return nav.canShare({ files: [file] })
  } catch {
    return false
  }
}

function probeFileSharing(): boolean {
  try {
    return canShareFiles(new File([new Blob(['pdf'])], 'probe.pdf', { type: 'application/pdf' }))
  } catch {
    return false
  }
}

export function WhatsAppDialog({
  quotation,
  onClose,
}: {
  quotation: Quotation
  onClose: () => void
}) {
  const [recipientName, setRecipientName] = useState(quotation.customerName)
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [message, setMessage] = useState(() => quotationWhatsAppMessage(quotation))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [supportsFileShare] = useState(probeFileSharing)

  function caption(): string {
    return recipientName ? `${message}\n\nTo: ${recipientName}` : message
  }

  async function handleSend() {
    setError(null)
    setNotice(null)

    const fileName = quotationPdfFileName(quotation)
    let file: File
    try {
      file = new File([quotationPdfBlob(quotation)], fileName, { type: 'application/pdf' })
    } catch {
      setError('Could not generate the PDF.')
      return
    }

    if (canShareFiles(file)) {
      const nav = navigator as ShareNavigator
      setBusy(true)
      try {
        await nav.share?.({ files: [file], title: 'Quotation', text: caption() })
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') {
          setError('Could not open the share sheet. Use Download PDF instead.')
        }
      } finally {
        setBusy(false)
      }
      return
    }

    // Fallback: download the PDF, then open a WhatsApp chat if a number is set.
    downloadQuotationPdf(quotation)
    const digits = mobile.replace(/\D/g, '')
    if (digits.length >= 6) {
      const phone = `${countryCode.replace(/\D/g, '')}${digits}`
      window.open(whatsAppUrl(phone, caption()), '_blank', 'noopener,noreferrer')
      setNotice('PDF downloaded — attach it in the WhatsApp chat that just opened.')
    } else {
      setNotice('PDF downloaded. Add a mobile number to also open the WhatsApp chat.')
    }
  }

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send quotation on WhatsApp"
        onClick={(event) => event.stopPropagation()}
        className="my-8 w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Send via WhatsApp</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <Field label="Recipient Name" htmlFor="waName">
            <TextInput id="waName" value={recipientName} onChange={setRecipientName} />
          </Field>

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <Field label="Country Code" htmlFor="waCountry">
              <TextInput
                id="waCountry"
                value={countryCode}
                onChange={(value) => setCountryCode(value.replace(/[^0-9+]/g, ''))}
                placeholder="+91"
              />
            </Field>
            <Field label="Mobile Number" htmlFor="waMobile" error={error ?? undefined}>
              <TextInput
                id="waMobile"
                value={mobile}
                onChange={(value) => setMobile(value.replace(/[^0-9]/g, ''))}
                placeholder="9963522888"
                invalid={Boolean(error)}
              />
            </Field>
          </div>

          <Field label="Message" htmlFor="waMessage">
            <TextArea id="waMessage" value={message} onChange={setMessage} rows={6} />
          </Field>

          {supportsFileShare ? (
            <p className="text-xs text-slate-500">
              Your device will open the share sheet — choose WhatsApp to send the PDF attached, with
              the message as its caption.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              This browser cannot attach files. The PDF will download and a WhatsApp chat will open
              with the message pre-filled — attach the downloaded PDF in the chat.
            </p>
          )}

          {notice ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={busy} variant={supportsFileShare ? 'success' : 'primary'}>
            {supportsFileShare ? 'Share PDF on WhatsApp' : 'Download PDF & Open WhatsApp'}
          </Button>
        </div>
      </div>
    </div>
  )
}
