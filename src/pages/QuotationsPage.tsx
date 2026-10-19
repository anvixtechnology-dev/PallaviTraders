/**
 * Saved quotations screen.
 *
 * A searchable list of every saved quotation. Click a quotation to preview it,
 * print, download or share. Edit opens the form pre-filled with its data;
 * Delete removes the document from Firestore after confirmation.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Quotation } from '@/types'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { useQuotations } from '@/hooks/useQuotations'
import { deleteQuotation } from '@/services/quotations.service'
import { toErrorMessage } from '@/lib/errors'
import { PageHeading } from '@/components/Layout'
import { Banner, Button, Card, Loading, TextInput } from '@/components/ui'
import { QuotationPreview } from '@/components/QuotationPreview'
import { ConfirmDialog } from '@/components/ConfirmDialog'

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
  const [toDelete, setToDelete] = useState<Quotation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletedMessage, setDeletedMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const filtered = useMemo(
    () => quotations.filter((quotation) => matches(quotation, query)),
    [quotations, query],
  )

  const selected = quotations.find((quotation) => quotation.id === selectedId) ?? null

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteQuotation(toDelete.id)
      setDeletedMessage(`Quotation ${toDelete.quotationNumber} deleted.`)
      setToDelete(null)
      if (selectedId === toDelete.id) {
        setSelectedId(null)
      }
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not delete the quotation. Please try again.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeading
        title="Saved Quotations"
        description="Search by customer name, quotation number or reference number, then edit, delete, preview, print or download a quotation."
      />

      {error ? (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4">
          <Banner tone="error">{actionError}</Banner>
        </div>
      ) : null}
      {deletedMessage ? (
        <div className="mb-4">
          <Banner tone="success">{deletedMessage}</Banner>
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
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quotation) => (
                  <tr key={quotation.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 font-medium text-slate-900"
                    >
                      {quotation.quotationNumber}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 text-slate-800"
                    >
                      {quotation.customerName}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 text-slate-600"
                    >
                      {quotation.customerGstNumber || '—'}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 text-slate-600"
                    >
                      {quotation.referenceNumber || '—'}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 text-slate-600"
                    >
                      {quotation.place || '—'}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="cursor-pointer px-4 py-2.5 text-slate-700"
                    >
                      {formatDate(quotation.date)}
                    </td>
                    <td
                      onClick={() => setSelectedId(quotation.id)}
                      className="tabular-nums cursor-pointer px-4 py-2.5 text-right font-semibold text-slate-900"
                    >
                      {formatMoney(quotation.grandTotal)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate('/form', { state: { editId: quotation.id } })}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setActionError(null)
                            setDeletedMessage(null)
                            setToDelete(quotation)
                          }}
                        >
                          Delete
                        </Button>
                      </div>
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

      {toDelete ? (
        <ConfirmDialog
          title="Delete quotation"
          busy={deleting}
          message={
            <>
              Are you sure you want to delete <strong>{toDelete.quotationNumber}</strong> for{' '}
              <strong>{toDelete.customerName}</strong>? This action cannot be undone and will
              permanently remove the quotation from Firestore.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </>
  )
}
