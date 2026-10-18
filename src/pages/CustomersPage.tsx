/**
 * Customers screen — the sales ledger grouped by customer, newest first.
 *
 * Every customer is a single row: all of their sales are folded into one set of
 * totals. The search box matches the customer name, a DS number or an item name.
 * Clicking a customer row expands the individual sales that make up the group;
 * clicking one of those opens the full sale with its line items.
 */

import { Fragment, useMemo, useState } from 'react'

import { PAYMENT_METHOD_LABELS, type Sale } from '@/types'
import { formatMoney, formatNumber } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { groupSalesByCustomer, saleItemSummary, saleMatches } from '@/lib/customers'
import { useSales } from '@/hooks/useSales'
import { PageHeading } from '@/components/Layout'
import { Banner, Card, Loading, PaymentBadge, TextInput } from '@/components/ui'

export function CustomersPage() {
  const { sales, loaded, error } = useSales()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(
    () => sales.filter((sale) => saleMatches(sale, query)),
    [sales, query],
  )

  const groups = useMemo(() => groupSalesByCustomer(filtered), [filtered])

  const selected = sales.find((sale) => sale.id === selectedId) ?? null

  function toggle(nameKey: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(nameKey)) next.delete(nameKey)
      else next.add(nameKey)
      return next
    })
  }

  return (
    <>
      <PageHeading
        title="Customers"
        description="Every customer with their purchases grouped together. Search by name, DS number or item, and click a customer to see the individual sales."
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
        ) : groups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {sales.length === 0
              ? 'No sales yet. Record one from the Form page.'
              : 'No customers match that search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">DS Numbers</th>
                  <th className="px-4 py-2.5 font-semibold">Sales</th>
                  <th className="px-4 py-2.5 font-semibold">Last Sale</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const isOpen = expanded.has(group.nameKey)
                  const dsNumbers =
                    group.sales
                      .map((sale) => sale.dsNumber)
                      .filter(Boolean)
                      .join(', ') || '—'

                  return (
                    <Fragment key={group.nameKey}>
                      <tr
                        onClick={() => toggle(group.nameKey)}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          <span className="mr-1 inline-block w-3 text-slate-400">
                            {isOpen ? '▾' : '▸'}
                          </span>
                          {group.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{dsNumbers}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {group.saleCount} {group.saleCount === 1 ? 'sale' : 'sales'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{formatDate(group.lastDate)}</td>
                        <td className="tabular-nums px-4 py-2.5 text-right text-slate-900">
                          {formatMoney(group.totalAmount)}
                        </td>
                        <td className="tabular-nums px-4 py-2.5 text-right text-slate-700">
                          {formatMoney(group.amountPaid)}
                        </td>
                        <td
                          className={`tabular-nums px-4 py-2.5 text-right ${
                            group.balanceAmount > 0 ? 'font-semibold text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {formatMoney(group.balanceAmount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <PaymentBadge status={group.paymentStatus} />
                        </td>
                      </tr>

                      {isOpen ? (
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              {group.sales.map((sale) => (
                                <button
                                  key={sale.id}
                                  type="button"
                                  onClick={() => setSelectedId(sale.id)}
                                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
                                >
                                  <span className="w-24 shrink-0 font-medium text-slate-700">
                                    {formatDate(sale.date)}
                                  </span>
                                  <span className="w-28 shrink-0 text-slate-600">
                                    {sale.dsNumber || 'No DS number'}
                                  </span>
                                  <span className="min-w-[8rem] flex-1 truncate text-slate-500">
                                    {saleItemSummary(sale)}
                                  </span>
                                  <span className="tabular-nums text-right font-semibold text-slate-900">
                                    {formatMoney(sale.totalAmount)}
                                  </span>
                                  {sale.balanceAmount > 0 ? (
                                    <span className="tabular-nums w-24 text-right text-xs font-semibold text-red-600">
                                      Bal {formatMoney(sale.balanceAmount)}
                                    </span>
                                  ) : null}
                                  <PaymentBadge status={sale.paymentStatus} />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
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
