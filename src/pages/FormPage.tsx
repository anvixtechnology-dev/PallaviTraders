/**
 * The "Form" page — a single quotation form.
 *
 * Quotations never touch stock: they are commercial offers that can be
 * previewed, printed, downloaded and shared. When navigated with an
 * `editId` (e.g. from the Quotations page), the form loads the saved
 * quotation and saves back as an update.
 */

import { useLocation, useNavigate } from 'react-router-dom'

import { QuotationForm } from '@/components/QuotationForm'
import { PageHeading } from '@/components/Layout'

export function FormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const editId = location.state && typeof (location.state as any).editId === 'string'
    ? (location.state as any).editId
    : null

  function cancelEdit() {
    navigate('/quotations', { replace: true })
  }

  return (
    <>
      <PageHeading
        title={editId ? 'Edit Quotation' : 'New Quotation'}
        description={
          editId
            ? 'Update the customer and line items, then save your changes back to the saved quotation.'
            : 'Enter the customer and line items, then generate a professional quotation.'
        }
      />
      <QuotationForm editId={editId} onCancel={cancelEdit} />
    </>
  )
}
