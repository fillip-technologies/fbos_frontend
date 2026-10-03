import { ApiError } from './client.js'

// Quota errors carry `meta: { limit, current }` in the problem body.
function quotaMessage(what) {
  return (err) => {
    const meta = err.details?.meta
    const usage = meta ? ` (${meta.current} of ${meta.limit} in use)` : ''
    return `Your plan's ${what} limit is reached${usage}. Ask the platform administrator to raise it.`
  }
}

// Human-friendly copy keyed by backend error `code`. Mirrors the Identity
// service's error catalog (exceptions.py) plus gateway/network codes. Anything
// not listed falls back to the backend's own message. An entry can be a
// function when the copy depends on the error's details.
const FRIENDLY = {
  // ---- Auth / login (identity) ----
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_LOCKED: 'Too many failed sign-ins. This account is locked for a few minutes — please try again later.',
  ACCOUNT_NOT_ACTIVE: 'This account is not active. If you were invited, accept your invitation to set a password first.',
  ORGANIZATION_AMBIGUOUS: 'This email exists in more than one organization. Use Organization sign-in with your organization code.',
  MFA_CODE_INVALID: 'That verification code is wrong or has already been used.',
  MFA_TOKEN_EXPIRED: 'Your sign-in session expired. Please start again.',
  INVITATION_INVALID: 'This invitation is invalid, already used, or expired.',
  PASSWORD_TOO_WEAK: 'Password must be at least 12 characters.',

  // ---- Access control ----
  CLIENT_ADMIN_REQUIRED: 'Only client administrators can do this.',

  // ---- Session / token ----
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  INVALID_TOKEN: 'Your session is invalid. Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Your session expired. Please sign in again.',
  REFRESH_TOKEN_REUSED: 'Your session was revoked for security reasons. Please sign in again.',
  CSRF_TOKEN_INVALID: 'Your session could not be verified. Please sign in again.',
  USER_NOT_FOUND: 'Your account could not be found.',

  // ---- Organizations ----
  ORGANIZATION_NOT_FOUND: 'This organization no longer exists.',
  ORGANIZATION_CODE_EXISTS: 'An organization with this code already exists. Choose a different code.',
  DUPLICATE_CODE: 'That code is already in use. Choose a different one.',
  CLIENT_ORGANIZATION_LIMIT_REACHED: quotaMessage('organization'),
  CLIENT_NOT_FOUND: 'Your client account no longer exists.',

  // ---- Users ----
  EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  ORGANIZATION_USER_LIMIT_REACHED: quotaMessage('user'),

  // ---- Validation / rate limiting ----
  VALIDATION_ERROR: 'Please fix the highlighted fields and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',

  // ---- Gateway / transport ----
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  GATEWAY_TIMEOUT: 'The server took too long to respond. Please try again.',
  BAD_REQUEST: 'The server could not process this request.',
  NETWORK_ERROR: 'Unable to reach the server. Make sure the backend is running (identity on :8001, or the gateway on :8000).',
}

// Best human message for any thrown error: friendly copy by code, else the
// backend/exception message, else a generic fallback.
export function friendlyMessage(err) {
  if (err instanceof ApiError) {
    const friendly = err.code && FRIENDLY[err.code]
    if (friendly) return typeof friendly === 'function' ? friendly(err) : friendly
    if (err.message && err.message !== 'Unable to reach the server.') return err.message
    return `Something went wrong${err.status ? ` (${err.status})` : ''}.`
  }
  return err?.message || 'Something went wrong.'
}

// Maps backend field-level issues to a { fieldName: issue } object so forms can
// show inline errors. Field names follow the request schema (name, code, ...).
export function getFieldErrors(err) {
  const map = {}
  if (err instanceof ApiError && Array.isArray(err.fieldErrors)) {
    for (const fe of err.fieldErrors) {
      if (fe.field) map[fe.field] = fe.issue
    }
  }
  return map
}

// Whether the UI should offer a "Retry" affordance.
export function isRetryable(err) {
  return err instanceof ApiError && err.retryable
}
