/** Date helpers. Business dates are handled as plain `YYYY-MM-DD` strings. */

/** Today's date in local time as `YYYY-MM-DD`. */
export function today(): string {
  return toDateKey(new Date())
}

/** Convert a Date to `YYYY-MM-DD` using local time (not UTC). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Format `YYYY-MM-DD` for display, e.g. `05 Mar 2026`. */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
