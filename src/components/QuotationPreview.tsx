/**
 * Quotation preview / print view.
 *
 * Rendered through a portal into a `.print-root` element directly under
 * `<body>`, so the print stylesheet can hide the rest of the app and print just
 * this sheet on A4. There is no PDF library — the user prints to PDF from the
 * browser.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'

import type { Quotation } from '@/types'
import { BUSINESS, quotationWhatsAppMessage, whatsAppUrl } from '@/lib/quotations'
import { formatDate } from '@/lib/dates'
import { formatNumber } from '@/lib/money'

function getPrintRoot(): HTMLElement {
  let root = document.querySelector<HTMLElement>('.print-root')
  if (!root) {
    root = document.createElement('div')
    root.className = 'print-root'
    document.body.appendChild(root)
  }
  return root
}

const COLUMNS = [
  { label: 'S.No', align: 'left' as const },
  { label: 'Description', align: 'left' as const },
  { label: 'Size', align: 'left' as const },
  { label: 'Qty', align: 'right' as const },
  { label: 'Thickness', align: 'left' as const },
  { label: 'Weight (Kg)', align: 'right' as const },
  { label: 'Rate/Kg', align: 'right' as const },
  { label: 'Amount (₹)', align: 'right' as const },
]

export function QuotationPreview({
  quotation,
  whatsAppPhone,
  onClose,
}: {
  quotation: Quotation
  whatsAppPhone: string
  onClose: () => void
}) {
  // The portal root is resolved once, on first render. `getPrintRoot` is
  // idempotent, so StrictMode's double render is harmless.
  const [root] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : getPrintRoot(),
  )

  if (!root) return null

  const digits = whatsAppPhone.replace(/\D/g, '')
  const waLink =
    digits.length >= 10 ? whatsAppUrl(whatsAppPhone, quotationWhatsAppMessage(quotation)) : null

  const infoRows: [string, string][] = [
    ['Quotation No', quotation.quotationNumber],
    ['Date', formatDate(quotation.date)],
    ['Reference No', quotation.referenceNumber || '—'],
    ['GSTIN', BUSINESS.gstin],
  ]

  return createPortal(
    <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-end gap-2">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            Send on WhatsApp
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Print / Save as PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-slate-900 shadow-lg">
        <header className="text-center">
          <h1 className="text-2xl font-bold tracking-wide text-blue-800">{BUSINESS.name}</h1>
          <p className="text-sm font-semibold text-blue-700">{BUSINESS.businessType}</p>
          <p className="text-xs text-slate-600">{BUSINESS.materials}</p>
          <p className="mt-1 text-xs text-slate-700">{BUSINESS.address}</p>
          <p className="text-xs text-slate-700">
            Mobile: {BUSINESS.mobile} &nbsp;·&nbsp; Proprietor: {BUSINESS.proprietor}
          </p>
        </header>

        <div className="my-3 h-[3px] w-full bg-amber-500 print-exact" />

        <h2 className="text-center text-xl font-bold tracking-[0.3em] text-amber-600">QUOTATION</h2>

        <table className="mt-4 w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="w-1/2 border border-slate-300 p-2 align-top">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {quotation.customerName}
                </div>
                {quotation.place ? (
                  <div className="text-slate-700">Place: {quotation.place}</div>
                ) : null}
              </td>
              <td className="w-1/2 border border-slate-300 p-0 align-top">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {infoRows.map(([label, value]) => (
                      <tr key={label} className="border-b border-slate-200 last:border-0">
                        <td className="px-2 py-1 font-medium text-slate-500">{label}</td>
                        <td className="px-2 py-1 text-right font-semibold text-slate-900">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-blue-800 text-white print-exact">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={`border border-blue-900 px-2 py-1.5 font-semibold ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, index) => (
              <tr key={index} className={index % 2 === 1 ? 'bg-slate-50 print-exact' : ''}>
                <td className="border border-slate-300 px-2 py-1.5">{index + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5">{item.description}</td>
                <td className="border border-slate-300 px-2 py-1.5">{item.size}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">
                  {formatNumber(item.quantity, 0)}
                </td>
                <td className="border border-slate-300 px-2 py-1.5">{item.thickness}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">
                  {formatNumber(item.weightKg)}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">
                  {formatNumber(item.ratePerKg)}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right font-medium">
                  {formatNumber(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-amber-50 font-semibold print-exact">
              <td colSpan={7} className="border border-slate-300 px-2 py-1.5 text-right">
                Grand Total
              </td>
              <td className="border border-slate-300 px-2 py-1.5 text-right">
                {formatNumber(quotation.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 text-xs">
          <span className="font-semibold">Amount in Words: </span>
          {quotation.amountInWords}
        </p>
        <p className="mt-1 text-xs text-slate-600">{BUSINESS.gstNote}</p>

        <div className="mt-12 flex justify-end">
          <div className="text-center text-xs">
            <div className="mb-12 font-semibold">For {BUSINESS.name}</div>
            <div className="border-t border-slate-400 pt-1">Authorised Signatory</div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-blue-700">
          {BUSINESS.name} · {BUSINESS.address} · Mobile: {BUSINESS.mobile} · GSTIN:{' '}
          {BUSINESS.gstin}
        </div>
      </div>

      <p className="no-print mx-auto mt-3 max-w-[210mm] text-center text-xs text-slate-300">
        Tip: choose “Save as PDF” in the print dialog, then attach the saved file in WhatsApp
        yourself — WhatsApp does not send the PDF automatically.
      </p>
    </div>,
    root,
  )
}
