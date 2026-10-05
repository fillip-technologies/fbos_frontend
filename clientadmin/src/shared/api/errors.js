import { ApiError } from '@/shared/api/http.js'

// Human-friendly copy keyed by backend error `code`. Mirrors the Identity
// service's error catalog (exceptions.py) plus gateway/network codes. Anything
// not listed falls back to the backend's own message.
const FRIENDLY = {
  // ---- Auth / login (identity) ----
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_LOCKED: 'Too many failed sign-ins. This account is locked for a few minutes — please try again later.',
  ACCOUNT_NOT_ACTIVE: 'This account is invited, suspended, or deactivated. Contact an administrator.',
  ORGANIZATION_AMBIGUOUS: 'This email exists in more than one company. Enter your company code and try again.',
  MFA_CODE_INVALID: 'That verification code is wrong or has already been used.',
  MFA_TOKEN_EXPIRED: 'Your sign-in session expired. Please start again.',
  RESET_TOKEN_INVALID: 'This reset link is invalid or has expired.',
  INVITATION_INVALID: 'This invitation is invalid or has expired.',
  PASSWORD_TOO_WEAK: 'Password must be at least 12 characters and not previously breached.',

  // ---- Access control ----
  PLATFORM_ADMIN_REQUIRED: 'This action is for platform super-admins only.',
  CLIENT_ADMIN_REQUIRED: 'You do not have permission for this action.',

  // ---- Session / token ----
  UNAUTHORIZED: 'Please sign in to continue.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  INVALID_TOKEN: 'Your session is invalid. Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Your session expired. Please sign in again.',
  REFRESH_TOKEN_REUSED: 'Your session was revoked for security reasons. Please sign in again.',
  SESSION_REVOKED: 'This browser was signed out. Please sign in again.',
  SESSION_NOT_FOUND: 'That session has already ended.',

  // ---- Subscription / quotas ----
  CLIENT_ORGANIZATION_LIMIT_REACHED: 'Your plan\'s company limit has been reached. Contact the platform admin to raise it.',
  ORGANIZATION_USER_LIMIT_REACHED: 'This company has reached its user limit. Contact the platform admin to raise it.',
  ORGANIZATION_CODE_EXISTS: 'A company with this code already exists. Choose a different code.',
  ORGANIZATION_NOT_FOUND: 'This company no longer exists.',
  EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  ORGANIZATION_NOT_ACTIVE: 'This company is not active, so users can\'t be invited into it.',

  // ---- Users & access ----
  PERMISSION_DENIED: 'You don\'t have permission to do this.',
  VALIDATION_FAILED: 'Some fields are invalid. Check the highlighted items.',
  USER_NOT_INVITED: 'This user has already activated (or was deactivated), so there is no invitation to resend.',
  USER_DEACTIVATED: 'This user is deactivated and can\'t be changed.',
  SELF_MODIFICATION_FORBIDDEN: 'You can\'t change your own account or access here.',
  PRECONDITION_FAILED: 'Someone else changed this in the meantime. Reload the page and try again.',
  ROLE_IS_SYSTEM: 'Built-in roles can\'t be edited. Create a custom role instead.',

  // ---- Org units ----
  ORG_UNIT_HIERARCHY_INVALID: 'That can\'t sit there. Branches sit directly under the company; departments go under a branch or another department; teams under a department.',
  ORG_UNIT_CYCLE: 'Nothing can be moved under itself or under something that sits inside it.',
  USER_NOT_FOUND: 'That person isn\'t in this company.',

  // ---- Clients ----
  SUBSCRIPTION_EXPIRED: 'Your account\'s subscription is not active. Please contact support to renew.',
  INVALID_SUBSCRIPTION_WINDOW: 'Service end must be on or after service start.',
  // Identity's tenant and revenue's customer share this code; in this console it is a customer.
  CLIENT_NOT_FOUND: 'This customer no longer exists.',
  CLIENT_CODE_EXISTS: 'A client with this code already exists. Choose a different code.',
  DUPLICATE_CODE: 'That code is already in use. Choose a different one.',

  // ---- Customers & client services (revenue) ----
  DUPLICATE_CLIENT: 'A customer with the same GSTIN already exists.',
  CONTACT_NOT_FOUND: 'This contact no longer exists.',
  SERVICE_CATEGORY_NOT_FOUND: 'That category no longer exists.',
  SERVICE_PROVIDER_NOT_FOUND: 'That provider no longer exists.',
  CLIENT_SERVICE_NOT_FOUND: 'This service record no longer exists.',
  DUPLICATE_NAME: 'That name is already in use. Choose a different one.',
  INVALID_DATE_RANGE: 'The end date must be on or after the start date.',
  PROVIDER_IN_USE: 'This provider is used by client services, so it can\'t be deleted.',
  VERSION_CONFLICT: 'Someone else changed this in the meantime. Reload the page and try again.',
  PRECONDITION_REQUIRED: 'This change needs the latest version. Reload the page and try again.',
  LEAD_NOT_FOUND: 'This lead no longer exists.',
  OPPORTUNITY_NOT_FOUND: 'This opportunity no longer exists.',
  QUOTATION_NOT_FOUND: 'This quotation no longer exists.',
  CONTRACT_NOT_FOUND: 'This contract no longer exists.',
  OFFERING_NOT_FOUND: 'That offering no longer exists.',
  INVALID_STATE_TRANSITION: 'That step isn\'t possible from the current status. Reload the page to see the latest.',
  QUOTATION_FROZEN: 'Only a draft quotation\'s lines can be changed. Revise it to make changes.',
  QUOTATION_NOT_ACCEPTED: 'A contract can only be made from an accepted quotation.',
  INVOICE_NOT_FOUND: 'This invoice no longer exists.',
  PAYMENT_NOT_FOUND: 'This payment no longer exists.',
  COLLECTION_CASE_NOT_FOUND: 'This collection case no longer exists.',
  INVOICE_ALREADY_ISSUED: 'This invoice has already been issued.',
  INVOICE_NOT_ISSUED: 'Only an issued invoice with money owed can take this. Issue the draft first.',
  INVOICE_PDF_NOT_AVAILABLE: 'Invoice PDFs aren\'t generated yet.',
  ALLOCATION_EXCEEDS_BALANCE: 'That is more than the invoice still owes.',
  ALLOCATION_EXCEEDS_PAYMENT: 'That is more than the payment has left to allocate.',
  ALLOCATION_CLIENT_MISMATCH: 'A payment can only settle invoices of the customer who paid it.',
  IDEMPOTENCY_KEY_REQUIRED: 'This request was missing its safety key. Please try again.',
  AUTH_SERVICE_UNAVAILABLE: 'Sign-in couldn\'t be checked right now. Please try again shortly.',
  SIGNED_COPY_REQUIRED: 'Attach the signed copy of the contract before activating it.',
  DOCUMENT_NOT_LINKED: 'That file isn\'t attached to this contract. Upload it here first.',
  DOCUMENTS_SERVICE_UNAVAILABLE: 'Documents couldn\'t be reached right now. Please try again shortly.',

  // ---- Documents ----
  FILE_TOO_LARGE: 'That file is larger than this category allows.',
  MIME_TYPE_NOT_ALLOWED: 'This category doesn\'t accept that type of file.',
  CATEGORY_UNKNOWN: 'That document category isn\'t set up for this company.',
  CATEGORY_CODE_EXISTS: 'A category with this code already exists.',
  SUBJECT_LOCKED: 'This record is closed and no longer takes new files.',
  SUBJECT_NOT_FOUND: 'The record these files belong to wasn\'t found, or you can\'t see it.',
  SUBJECT_SERVICE_UNAVAILABLE: 'Access to this record couldn\'t be checked right now. Please try again shortly.',
  UPLOAD_EXPIRED: 'The upload took too long and expired. Please try again.',
  CHECKSUM_MISMATCH: 'The file didn\'t arrive intact. Please upload it again.',
  DOCUMENT_SCAN_PENDING: 'This file is still being scanned. Try again in a moment.',
  DOCUMENT_INFECTED: 'This file failed the virus scan and can\'t be downloaded.',
  STORAGE_UPLOAD_FAILED: 'The file couldn\'t be sent to storage. Please try again.',

  // ---- Validation / rate limiting ----
  VALIDATION_ERROR: 'Please fix the highlighted fields and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',

  // ---- Gateway / transport ----
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  GATEWAY_TIMEOUT: 'The server took too long to respond. Please try again.',
  BAD_REQUEST: 'The server could not process this request.',
  NETWORK_ERROR: 'Unable to reach the server. Make sure the backend is running (identity on :8001, revenue on :8002 and documents on :8005, or the gateway on :8000).',
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
