/**
 * Quotation preview / print view.
 *
 * Rendered through a portal into a `.print-root` element directly under
 * `<body>`, so the print stylesheet can hide the rest of the app and print just
 * this sheet on A4. The same data is used to build a real PDF via jsPDF.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'

import type { Quotation } from '@/types'
import { BUSINESS, GST_NOTE, quotationTableRows } from '@/lib/quotations'
import { downloadQuotationPdf } from '@/lib/quotation-pdf'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { WhatsAppDialog } from '@/components/WhatsAppDialog'

function getPrintRoot(): HTMLElement {
  let root = document.querySelector<HTMLElement>('.print-root')
  if (!root) {
    root = document.createElement('div')
    root.className = 'print-root'
    document.body.appendChild(root)
  }
  return root
}

function infoRows(quotation: Quotation): [string, string][] {
  const rows: [string, string][] = [
    ['Quotation No', quotation.quotationNumber],
    ['Customer Name', quotation.customerName],
    ['Reference No', quotation.referenceNumber || '—'],
    ['Place', quotation.place || '—'],
    ['Date', formatDate(quotation.date)],
  ]
  if (quotation.customerGstNumber) {
    rows.push(['Customer GSTIN', quotation.customerGstNumber])
  }
  return rows
}

export function QuotationPreview({
  quotation,
  onClose,
  closeLabel = 'Edit Details',
}: {
  quotation: Quotation
  onClose: () => void
  /** Label for the close button; "Edit Details" returns to the form. */
  closeLabel?: string
}) {
  // The portal root is resolved once, on first render. `getPrintRoot` is
  // idempotent, so StrictMode's double render is harmless.
  const [root] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : getPrintRoot(),
  )
  const [waOpen, setWaOpen] = useState(false)

  if (!root) return null

  const tableRows = quotationTableRows(quotation)

  const infoEntries = infoRows(quotation)
  const infoPairs: ([string, string] | null)[][] = []
  for (let i = 0; i < infoEntries.length; i += 2) {
    infoPairs.push([infoEntries[i], infoEntries[i + 1] ?? null])
  }

  return createPortal(
    <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => downloadQuotationPdf(quotation)}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Print Quotation
        </button>
        <button
          type="button"
          onClick={() => setWaOpen(true)}
          className="rounded-md border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
        >
          Send via WhatsApp
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
        >
          {closeLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-lg leading-none text-stone-600 hover:bg-stone-50"
        >
          ×
        </button>
      </div>

      <div className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-slate-900 shadow-lg">
        <header className="relative text-center">
          <div className="absolute right-0 top-0 text-xs font-medium text-slate-700">
            Date: {formatDate(quotation.date)}
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-blue-800">{BUSINESS.name}</h1>
          <p className="text-sm font-semibold text-blue-700">{BUSINESS.businessType}</p>
          <p className="text-xs text-slate-600">{BUSINESS.materials}</p>
          <p className="mt-1 text-xs text-slate-700">{BUSINESS.address}</p>
          <p className="text-xs text-slate-700">
            Mobile: {BUSINESS.mobile} &nbsp;·&nbsp; Proprietors: {BUSINESS.proprietors} &nbsp;·&nbsp;
            GSTIN: {BUSINESS.gstin}
          </p>
        </header>

        <div className="my-3 h-[3px] w-full bg-amber-500 print-exact" />

        <h2 className="text-center text-xl font-bold tracking-[0.3em] text-amber-600">QUOTATION</h2>

        <table className="mt-4 w-full border-collapse text-xs">
          <tbody>
            {infoPairs.map((pair, rowIndex) => (
              <tr key={rowIndex}>
                {pair.map((entry, cellIndex) =>
                  entry ? (
                    <InfoCell key={entry[0]} label={entry[0]} value={entry[1]} />
                  ) : (
                    <InfoCell key={`empty-${cellIndex}`} label="" value="" />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {tableRows.length > 0 ? (
          <Section title="Items">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[11%]" />
                <col className="w-[18%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="bg-blue-800 text-white print-exact">
                  <Th>S.No</Th>
                  <Th>Category</Th>
                  <Th>Item / Type</Th>
                  <Th>Size</Th>
                  <Th right>Length (Ft)</Th>
                  <Th right>Weight (Kg)</Th>
                  <Th right>Qty / Pieces</Th>
                  <Th right>Rate</Th>
                  <Th right>Amount (₹)</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 === 1 ? 'bg-slate-50 print-exact' : ''}
                  >
                    {row.map((cell, cellIndex) => (
                      <Td key={cellIndex} right={cellIndex >= 4} strong={cellIndex === 8}>
                        {cell}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        <div className="mt-4 flex justify-end">
          <div className="flex items-stretch overflow-hidden rounded-md border border-blue-900 text-sm print-exact">
            <span className="bg-blue-800 px-4 py-2 font-bold tracking-wide text-white">
              GRAND TOTAL
            </span>
            <span className="min-w-[8rem] bg-amber-50 px-4 py-2 text-right text-base font-bold text-slate-900">
              {formatMoney(quotation.grandTotal)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs">
          <span className="font-semibold">Amount in Words: </span>
          {quotation.amountInWords}
        </p>
        <p className="mt-1 text-xs text-slate-600">{GST_NOTE}</p>

        <div className="mt-12 flex justify-end">
          <div className="text-center text-xs">
            <div className="mb-12 font-semibold">For {BUSINESS.name}</div>
            <div className="border-t border-slate-400 pt-1">Authorized Signature</div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-blue-700">
          {BUSINESS.name} · {BUSINESS.address} · Mobile: {BUSINESS.mobile} · GSTIN: {BUSINESS.gstin}
        </div>
      </div>

      <p className="no-print mx-auto mt-3 max-w-[210mm] text-center text-xs text-slate-300">
        Tip: on a phone or tablet, use “Send via WhatsApp” to share the PDF attached. On desktop,
        choose “Save as PDF” in the print dialog or use Download PDF, then attach the file in
        WhatsApp yourself.
      </p>

      {waOpen ? <WhatsAppDialog quotation={quotation} onClose={() => setWaOpen(false)} /> : null}
    </div>,
    root,
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <>
      <td className="w-[18%] border border-slate-300 bg-slate-50 px-2 py-1 font-medium text-slate-500 print-exact">
        {label}
      </td>
      <td className="w-[32%] border border-slate-300 px-2 py-1 font-semibold text-slate-900">
        {value}
      </td>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-bold text-blue-800">{title}</h3>
      {children}
    </div>
  )
}

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`border border-blue-900 px-2 py-1.5 font-semibold ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  right = false,
  strong = false,
}: {
  children: React.ReactNode
  right?: boolean
  strong?: boolean
}) {
  return (
    <td
      className={`break-words border border-slate-300 px-2 py-1.5 ${right ? 'text-right' : ''} ${
        strong ? 'font-medium' : ''
      }`}
    >
      {children}
    </td>
  )
}
