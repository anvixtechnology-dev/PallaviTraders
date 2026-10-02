/**
 * Customers screen — one row per customer, most recently active first.
 *
 * Every saved purchase belongs to a customer, so the ledger is folded into one
 * row per customer (see `lib/customers`). Clicking a row opens that customer's
 * complete history in a dialog rather than a separate screen, so the app stays at
 * three pages.
 */

import { useMemo, useState } from 'react'

import {
  CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type Purchase,
} from '@/types'
import { formatMoney, formatNumber } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import {
  customerMatches,
  groupPurchasesByCustomer,
  purchasedCategories,
  type CustomerSummary,
} from '@/lib/customers'
import { usePurchases } from '@/hooks/usePurchases'
import { PageHeading } from '@/components/Layout'
import { Banner, Card, Loading, PaymentBadge, TextInput } from '@/components/ui'

export function CustomersPage() {
  const { purchases, loaded, error } = usePurchases()
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const customers = useMemo(() => groupPurchasesByCustomer(purchases), [purchases])

  const filtered = useMemo(
    () => customers.filter((customer) => customerMatches(customer, query)),
    [customers, query],
  )

  // Looked up by key rather than held as an object so the open dialog keeps
  // showing live totals while a purchase is being added elsewhere.
  const selected = customers.find((customer) => customer.key === selectedKey) ?? null

  return (
    <>
      <PageHeading
        title="Customers"
        description="Every customer with their totals. Click a row to see their complete purchase history."
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
          placeholder="Search name, DS number or item"
        />
      </div>

      <Card className="p-0">
        {!loaded ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {customers.length === 0
              ? 'No customer records yet. Save a purchase from the Form page.'
              : 'No customers match that search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">DS Number</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Purchases</th>
                  <th className="px-4 py-2.5 font-semibold">Last Activity</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer.key}
                    onClick={() => setSelectedKey(customer.key)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">{customer.name}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {customer.dsNumbers.length > 0 ? customer.dsNumbers.join(', ') : '—'}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right text-slate-700">
                      {customer.purchaseCount}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {formatDate(customer.lastDate)}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right text-slate-900">
                      {formatMoney(customer.totalAmount)}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right text-slate-700">
                      {formatMoney(customer.amountPaid)}
                    </td>
                    <td
                      className={`tabular-nums px-4 py-2.5 text-right ${
                        customer.balanceAmount > 0
                          ? 'font-semibold text-red-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {formatMoney(customer.balanceAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? (
        <CustomerDialog customer={selected} onClose={() => setSelectedKey(null)} />
      ) : null}
    </>
  )
}

function CustomerDialog({
  customer,
  onClose,
}: {
  customer: CustomerSummary;
  onClose: () => void;
}) {
  const bought = purchasedCategories(customer.quantities)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`All purchases for ${customer.name}`}
        onClick={(event) => event.stopPropagation()}
        className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{customer.name}</h3>
            <p className="text-sm text-slate-600">
              {customer.dsNumbers.length > 0 ? customer.dsNumbers.join(', ') : 'No DS number'} ·{' '}
              {customer.purchaseCount === 1 ? '1 purchase' : `${customer.purchaseCount} purchases`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-slate-500">Total Billed</dt>
              <dd className="tabular-nums text-base font-bold text-slate-900">
                {formatMoney(customer.totalAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Total Paid</dt>
              <dd className="tabular-nums text-base font-semibold text-slate-900">
                {formatMoney(customer.amountPaid)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Outstanding</dt>
              <dd
                className={`tabular-nums text-base font-semibold ${
                  customer.balanceAmount > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatMoney(customer.balanceAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Period</dt>
              <dd className="text-sm font-medium text-slate-900">
                {formatDate(customer.firstDate)}
                {customer.firstDate !== customer.lastDate ? ` – ${formatDate(customer.lastDate)}` : ''}
              </dd>
            </div>
          </dl>

          {bought.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              {bought.map((category) => (
                <span
                  key={category}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                >
                  {CATEGORY_LABELS[category]}:{' '}
                  <span className="tabular-nums font-semibold">
                    {formatNumber(customer.quantities[category], 0)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Purchase History
          </h4>
          <ul className="flex flex-col gap-1">
            {customer.purchases.map((purchase) => (
              <PurchaseHistoryRow key={purchase.id} purchase={purchase} />
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-200 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** One purchase in the history; clicking it reveals that purchase's line items. */
function PurchaseHistoryRow({ purchase }: { purchase: Purchase }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="rounded-md border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-medium text-slate-900">{formatDate(purchase.date)}</span>
          <span className="text-xs text-slate-500">
            {purchase.dsNumber || 'No DS number'} · {purchase.items.length}{' '}
            {purchase.items.length === 1 ? 'item' : 'items'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="tabular-nums font-medium text-slate-900">
            {formatMoney(purchase.totalAmount)}
          </span>
          <PaymentBadge status={purchase.paymentStatus} />
          <span className="text-xs text-slate-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-3 py-3">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 font-semibold">Item</th>
                <th className="pb-2 text-right font-semibold">Quantity</th>
                <th className="pb-2 text-right font-semibold">Price</th>
                <th className="pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.category} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800">{CATEGORY_LABELS[item.category]}</td>
                  <td className="tabular-nums py-2 text-right text-slate-700">
                    {formatNumber(item.quantity)}
                  </td>
                  <td className="tabular-nums py-2 text-right text-slate-700">
                    {formatMoney(item.pricePerUnit)}
                  </td>
                  <td className="tabular-nums py-2 text-right font-medium text-slate-900">
                    {formatMoney(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 flex flex-col gap-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Payment Method</dt>
              <dd className="font-medium text-slate-900">
                {PAYMENT_METHOD_LABELS[purchase.paymentMethod]}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Amount Paid</dt>
              <dd className="tabular-nums font-medium text-slate-900">
                {formatMoney(purchase.amountPaid)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Balance</dt>
              <dd
                className={`tabular-nums font-medium ${
                  purchase.balanceAmount > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatMoney(purchase.balanceAmount)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </li>
  )
}
