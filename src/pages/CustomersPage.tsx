/**
 * Customers screen — the sales ledger, newest first.
 *
 * Every saved sale is one row. The search box matches the customer name, the DS
 * number or an item name on the sale. Clicking a row opens the full sale with
 * its line items. There is no per-customer editing here; the aggregate customer
 * records live in the `customers` collection and are maintained by the sale
 * transaction.
 */

import { useMemo, useState } from 'react'

import { PAYMENT_METHOD_LABELS, type Sale } from '@/types'
import { formatMoney, formatNumber } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { saleItemSummary, saleMatches } from '@/lib/customers'
import { useSales } from '@/hooks/useSales'
import { PageHeading } from '@/components/Layout'
import { Banner, Card, Loading, PaymentBadge, TextInput } from '@/components/ui'

export function CustomersPage() {
  const { sales, loaded, error } = useSales()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(
    () => sales.filter((sale) => saleMatches(sale, query)),
    [sales, query],
  )

  const selected = sales.find((sale) => sale.id === selectedId) ?? null

  return (
    <>
      <PageHeading
        title="Customers"
        description="Every recorded sale. Search by customer name, DS number or item, and click a row for the full details."
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
            {sales.length === 0
              ? 'No sales yet. Record one from the Form page.'
              : 'No sales match that search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">DS Number</th>
                  <th className="px-4 py-2.5 font-semibold">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedId(sale.id)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 text-slate-700">{formatDate(sale.date)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{sale.customerName}</td>
                    <td className="px-4 py-2.5 text-slate-700">{sale.dsNumber || '—'}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5 text-slate-600">
                      {saleItemSummary(sale)}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right text-slate-900">
                      {formatMoney(sale.totalAmount)}
                    </td>
                    <td className="tabular-nums px-4 py-2.5 text-right text-slate-700">
                      {formatMoney(sale.amountPaid)}
                    </td>
                    <td
                      className={`tabular-nums px-4 py-2.5 text-right ${
                        sale.balanceAmount > 0 ? 'font-semibold text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {formatMoney(sale.balanceAmount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PaymentBadge status={sale.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? <SaleDialog sale={selected} onClose={() => setSelectedId(null)} /> : null}
    </>
  )
}

function SaleDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sale for ${sale.customerName}`}
        onClick={(event) => event.stopPropagation()}
        className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{sale.customerName}</h3>
            <p className="text-sm text-slate-600">
              {formatDate(sale.date)} · {sale.dsNumber || 'No DS number'}
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
              {sale.items.map((item) => (
                <tr key={item.stockItemId} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800">{item.itemName}</td>
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
              <dt className="text-slate-600">Grand Total</dt>
              <dd className="tabular-nums font-bold text-slate-900">
                {formatMoney(sale.totalAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Payment Method</dt>
              <dd className="font-medium text-slate-900">
                {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Amount Paid</dt>
              <dd className="tabular-nums font-medium text-slate-900">
                {formatMoney(sale.amountPaid)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Balance</dt>
              <dd
                className={`tabular-nums font-medium ${
                  sale.balanceAmount > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatMoney(sale.balanceAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Status</dt>
              <dd>
                <PaymentBadge status={sale.paymentStatus} />
              </dd>
            </div>
          </dl>
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
