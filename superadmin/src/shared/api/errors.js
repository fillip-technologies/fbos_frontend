import { ApiError } from '@/shared/api/http.js'

// Human-friendly copy keyed by backend error `code`. Mirrors the Identity
// service's error catalog (exceptions.py) plus gateway/network codes. Anything
// not listed falls back to the backend's own message.
const FRIENDLY = {
  // ---- Auth / login (identity) ----
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_LOCKED: 'Too many failed sign-ins. This account is locked for a few minutes — please try again later.',
  ACCOUNT_NOT_ACTIVE: 'This account is invited, suspended, or deactivated. Contact an administrator.',
  ORGANIZATION_AMBIGUOUS: 'This email exists in more than one organization. Enter your organization code and try again.',
  MFA_CODE_INVALID: 'That verification code is wrong or has already been used.',
  MFA_TOKEN_EXPIRED: 'Your sign-in session expired. Please start again.',
  RESET_TOKEN_INVALID: 'This reset link is invalid or has expired.',
  INVITATION_INVALID: 'This invitation is invalid or has expired.',
  PASSWORD_TOO_WEAK: 'Password must be at least 12 characters and not previously breached.',

  // ---- Access control ----
  PLATFORM_ADMIN_REQUIRED: 'This console is for platform super-admins only.',
  CLIENT_ADMIN_REQUIRED: 'You do not have permission for this action.',

  // ---- Session / token ----
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  INVALID_TOKEN: 'Your session is invalid. Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Your session expired. Please sign in again.',
  REFRESH_TOKEN_REUSED: 'Your session was revoked for security reasons. Please sign in again.',

  // ---- Clients ----
  SUBSCRIPTION_EXPIRED: 'Your organization\'s subscription is not active. Please contact support to renew.',
  INVALID_SUBSCRIPTION_WINDOW: 'Service end must be on or after service start.',
  CLIENT_NOT_FOUND: 'This client no longer exists.',
  CLIENT_CODE_EXISTS: 'A client with this code already exists. Choose a different code.',
  DUPLICATE_CODE: 'That code is already in use. Choose a different one.',

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
    if (err.code && FRIENDLY[err.code]) return FRIENDLY[err.code]
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
