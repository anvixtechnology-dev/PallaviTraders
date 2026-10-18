/**
 * Saved quotations screen.
 *
 * A searchable list of every saved quotation. Clicking a row opens the full
 * quotation preview, from which it can be printed, downloaded or shared.
 */

import { useMemo, useState } from 'react'

import type { Quotation } from '@/types'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { useQuotations } from '@/hooks/useQuotations'
import { PageHeading } from '@/components/Layout'
import { Banner, Card, Loading, TextInput } from '@/components/ui'
import { QuotationPreview } from '@/components/QuotationPreview'

function matches(quotation: Quotation, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    quotation.customerName.toLowerCase().includes(needle) ||
    quotation.quotationNumber.toLowerCase().includes(needle) ||
    quotation.referenceNumber.toLowerCase().includes(needle)
  )
}

export function QuotationsPage() {
  const { quotations, loaded, error } = useQuotations()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(
    () => quotations.filter((quotation) => matches(quotation, query)),
    [quotations, query],
  )

  const selected = quotations.find((quotation) => quotation.id === selectedId) ?? null

  return (
    <>
      <PageHeading
        title="Saved Quotations"
        description="Search by customer name, quotation number or reference number, then open a quotation to print or download it."
      />

      {error ? (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      <div className="mb-4 max-w-xs">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Search customer, quotation no. or reference"
        />
      </div>

      <Card className="p-0">
        {!loaded ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {quotations.length === 0
              ? 'No quotations yet. Create one from the Form page.'
              : 'No quotations match that search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Quotation No</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Customer GSTIN</th>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Place</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quotation) => (
                  <tr
                    key={quotation.id}
                    onClick={() => setSelectedId(quotation.id)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {quotation.quotationNumber}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">{quotation.customerName}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {quotation.customerGstNumber || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {quotation.referenceNumber || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{quotation.place || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{formatDate(quotation.date)}</td>
                    <td className="tabular-nums px-4 py-2.5 text-right font-semibold text-slate-900">
                      {formatMoney(quotation.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? (
        <QuotationPreview
          quotation={selected}
          closeLabel="Close"
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  )
}
