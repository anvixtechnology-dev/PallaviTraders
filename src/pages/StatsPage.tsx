/**
 * Stats screen — current stock for the three categories, plus the form the admin
 * uses to enter or correct those quantities.
 */

import { useState } from 'react'

import { CATEGORIES, CATEGORY_LABELS, type Category, type Stock } from '@/types'
import { toErrorMessage } from '@/lib/errors'
import { formatNumber } from '@/lib/money'
import { useStock } from '@/hooks/useStock'
import { saveStock } from '@/services/stock.service'
import { PageHeading } from '@/components/Layout'
import { Banner, Button, Card, CardTitle, Field, Loading, NumberInput } from '@/components/ui'

export function StatsPage() {
  const { stock, loaded, error } = useStock()

  // Local draft so typing never fights the live subscription. It is re-seeded
  // during render whenever the stored values are replaced by a new snapshot.
  const [draft, setDraft] = useState<Stock>(stock)
  const [seededStock, setSeededStock] = useState<Stock>(stock)
  if (stock !== seededStock) {
    setSeededStock(stock)
    setDraft(stock)
  }

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dirty = CATEGORIES.some((category) => String(draft[category]) !== String(stock[category]))

  function updateDraft(category: Category, raw: string) {
    setSaved(false)
    setDraft((current) => ({ ...current, [category]: Number(raw) || 0 }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await saveStock(draft)
      setSaved(true)
    } catch (err) {
      setSaveError(toErrorMessage(err, 'Could not save stock.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading title="Current Stock" />

      {error ? (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      {!loaded ? (
        <Card className="p-5">
          <Loading />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Card key={category} className="p-5 text-center">
              <p className="text-sm font-medium text-slate-600">{CATEGORY_LABELS[category]}</p>
              <p className="tabular-nums mt-2 text-3xl font-bold text-slate-900">
                {formatNumber(stock[category], 0)}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 p-5">
        <CardTitle>Update Stock</CardTitle>
        <p className="-mt-3 mb-4 text-sm text-slate-600">
          Enter the quantity you have on hand. This replaces the values above.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {CATEGORIES.map((category) => (
              <Field key={category} label={CATEGORY_LABELS[category]} htmlFor={`stock-${category}`}>
                <NumberInput
                  id={`stock-${category}`}
                  value={String(draft[category])}
                  onChange={(value) => updateDraft(category, value)}
                  min={0}
                />
              </Field>
            ))}
          </div>

          {saveError ? <Banner tone="error">{saveError}</Banner> : null}
          {saved && !dirty ? <Banner tone="success">Stock updated.</Banner> : null}

          <div>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save Stock'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
