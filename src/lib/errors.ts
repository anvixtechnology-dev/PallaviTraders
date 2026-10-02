/**
 * Application errors.
 *
 * The service layer throws these; the UI turns them into field messages or a
 * simple red banner. Anything that is not an `AppError` is treated as an
 * unexpected failure and reported with a generic (but still logged) message.
 */

import { CATEGORY_LABELS, type StockShortfall } from '@/types'

export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'AppError'
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

/** A form value failed validation. `fieldErrors` keys match form field names. */
export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string>

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * The form asked for more than the shop has on hand. Carries the per-category
 * detail so the form can point at the exact row that is too large.
 */
export class InsufficientStockError extends AppError {
  readonly shortfalls: StockShortfall[]

  constructor(shortfalls: StockShortfall[]) {
    super(describeShortfalls(shortfalls))
    this.name = 'InsufficientStockError'
    this.shortfalls = shortfalls
  }
}

function describeShortfalls(shortfalls: StockShortfall[]): string {
  if (shortfalls.length === 0) return 'Not enough stock available.'
  if (shortfalls.length === 1) {
    const [only] = shortfalls
    return `Only ${only.available} ${CATEGORY_LABELS[only.category].toLowerCase()} in stock, but ${only.requested} were requested.`
  }
  return `Not enough stock for: ${shortfalls.map((s) => CATEGORY_LABELS[s.category].toLowerCase()).join(', ')}.`
}

const MAX_CAUSE_DEPTH = 5

/**
 * Reads the Firebase error code (for example `auth/operation-not-allowed`) from a
 * thrown value. Wrapping an error for a friendlier message drops its `code`, so
 * the `cause` chain is followed as well; otherwise the setup hints on the login
 * screen could never recognise a configuration problem. The depth limit stops a
 * self-referencing cause from looping forever.
 */
function errorCode(error: unknown, depth = 0): string | undefined {
  if (typeof error !== 'object' || error === null || depth > MAX_CAUSE_DEPTH) return undefined
  const candidate = error as { code?: unknown; cause?: unknown }
  if (typeof candidate.code === 'string') return candidate.code
  return errorCode(candidate.cause, depth + 1)
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return ''
}

/**
 * Cloud Firestore has to be switched on once per Firebase project. Until it is,
 * every read and write fails with a long, alarming Google message, so it is
 * worth replacing with something the shop owner can act on.
 */
export function isFirestoreNotEnabled(error: unknown): boolean {
  return /has not been used in project|api has not been used|is disabled/i.test(errorText(error))
}

const FIRESTORE_NOT_ENABLED =
  'Cloud Firestore is not switched on for this project yet. Open the Firebase console, enable Cloud Firestore, create the database, then deploy the security rules.'

/** Extract a human-readable message from anything that was thrown. */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isFirestoreNotEnabled(error)) return FIRESTORE_NOT_ENABLED
  if (error instanceof AppError) return error.message
  if (error instanceof Error && error.message) return error.message

  switch (errorCode(error)) {
    case 'permission-denied':
      return 'You do not have permission to perform this action.'
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Could not reach the server. Check your connection and try again.'
    case 'not-found':
      return 'The requested record no longer exists.'
    default:
      return fallback
  }
}

/** Field-level messages from a `ValidationError`, or an empty object. */
export function toFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ValidationError ? error.fieldErrors : {}
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That admin account could not be verified. Check the details below.',
  'auth/user-not-found': 'This admin account has not been created in Firebase yet.',
  'auth/wrong-password': 'That admin account could not be verified. Check the details below.',
  'auth/user-disabled': 'This admin account has been disabled.',
  'auth/operation-not-allowed': 'Email/Password sign-in is switched off for this Firebase project.',
  'auth/configuration-not-found': 'Email/Password sign-in is not set up for this Firebase project yet.',
  'auth/network-request-failed': 'Could not reach the server. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
}

/** Human-readable reason a sign-in failed, without Firebase's raw wording. */
export function toAuthErrorMessage(error: unknown, fallback = 'Could not sign in. Please try again.'): string {
  const code = errorCode(error)
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]
  return toErrorMessage(error, fallback)
}

/**
 * True when the failure is a Firebase setup problem rather than a wrong
 * credential, so the login screen can show the console steps to fix it.
 */
export function isAuthSetupError(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed'
}
