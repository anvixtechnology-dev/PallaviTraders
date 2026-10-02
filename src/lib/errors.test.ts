import { describe, expect, it } from 'vitest'

import { InsufficientStockError, isFirestoreNotEnabled, toErrorMessage, toFieldErrors } from './errors'

describe('isFirestoreNotEnabled', () => {
  it('recognises the Cloud Firestore API error', () => {
    const error = new Error(
      'Cloud Firestore API has not been used in project pallavitraders before or it is disabled. ' +
        'Enable it by visiting https://console.developers.google.com/apis/api/firestore.googleapis.com',
    )
    expect(isFirestoreNotEnabled(error)).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isFirestoreNotEnabled(new Error('Network error'))).toBe(false)
    expect(isFirestoreNotEnabled(undefined)).toBe(false)
  })
})

describe('toErrorMessage', () => {
  it('replaces the raw Google message with an actionable one', () => {
    const message = toErrorMessage(
      new Error('Cloud Firestore API has not been used in project pallavitraders before or it is disabled.'),
    )
    expect(message).toMatch(/not switched on/i)
    expect(message).not.toMatch(/has not been used in project/)
  })

  it('explains a permission failure', () => {
    expect(toErrorMessage({ code: 'permission-denied' })).toMatch(/permission/i)
  })

  it('explains an offline failure', () => {
    expect(toErrorMessage({ code: 'unavailable' })).toMatch(/connection/i)
  })

  it('uses the fallback for anything unknown', () => {
    expect(toErrorMessage({}, 'Could not save.')).toBe('Could not save.')
  })
})

describe('InsufficientStockError', () => {
  it('names the single category that is short', () => {
    const error = new InsufficientStockError([{ category: 'pipes', requested: 10, available: 4 }])
    expect(error.message).toMatch(/only 4 pipes in stock/i)
    expect(error.shortfalls).toHaveLength(1)
  })

  it('lists every short category', () => {
    const error = new InsufficientStockError([
      { category: 'pipes', requested: 10, available: 4 },
      { category: 'sheets', requested: 30, available: 5 },
    ])
    expect(error.message).toMatch(/pipes, sheets/i)
  })
})

describe('toFieldErrors', () => {
  it('returns an empty object for other errors', () => {
    expect(toFieldErrors(new Error('boom'))).toEqual({})
  })
})
