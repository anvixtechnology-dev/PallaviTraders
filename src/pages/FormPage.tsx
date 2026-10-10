/**
 * The "Form" page.
 *
 * Two tabs:
 *  - Sale: records a sale and reduces stock (see `SaleForm`).
 *  - Quotation: prepares a printable quotation that never touches stock.
 */

import { useState } from 'react'

import { SaleForm } from '@/components/SaleForm'
import { QuotationForm } from '@/components/QuotationForm'
import { PageHeading } from '@/components/Layout'

type Tab = 'sale' | 'quotation'

const TABS: { value: Tab; label: string }[] = [
  { value: 'sale', label: 'Sale' },
  { value: 'quotation', label: 'Quotation' },
]

export function FormPage() {
  const [tab, setTab] = useState<Tab>('sale')

  return (
    <>
      <PageHeading
        title="New Entry"
        description="Record a sale (reduces stock) or prepare a quotation (does not touch stock)."
      />

      <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === entry.value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'sale' ? <SaleForm /> : <QuotationForm />}
    </>
  )
}
