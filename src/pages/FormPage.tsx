/**
 * The "Form" page — a single quotation form.
 *
 * Quotations never touch stock: they are commercial offers that can be
 * previewed, printed, downloaded and shared.
 */

import { QuotationForm } from '@/components/QuotationForm'
import { PageHeading } from '@/components/Layout'

export function FormPage() {
  return (
    <>
      <PageHeading
        title="New Quotation"
        description="Enter the customer and line items, then generate a professional quotation."
      />
      <QuotationForm />
    </>
  )
}
