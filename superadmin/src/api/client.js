// Thin fetch wrapper around the FBOS Identity service.
// The browser always calls same-origin `/api/*`; the Vite dev proxy forwards to
// the backend (see vite.config.js), which sidesteps the missing CORS.

const IDENTITY = '/api/identity/v1'

let accessToken = null
let onUnauthorized = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

// Registered by the auth layer: invoked when an authenticated call gets a 401
// (e.g. the 15-min access token expired) so the session can be cleared.
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

// Raised for any non-2xx response (and network failures).
// Carries the backend error `code` plus normalized extras so the UI can react:
//   - code:        machine code, e.g. "CLIENT_CODE_EXISTS", "VALIDATION_ERROR", "NETWORK_ERROR"
//   - title:       short human title (RFC 7807 problem responses)
//   - retryable:   backend hint that retrying may succeed (503/504/429/network)
//   - fieldErrors: [{ field, issue }] for form-level validation/conflict display
export class ApiError extends Error {
  constructor(message, { status = 0, code, title, retryable = false, fieldErrors = null, details, cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.title = title
    this.retryable = retryable
    this.fieldErrors = fieldErrors
    this.details = details
    if (cause) this.cause = cause
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR'
  }
}

// Normalizes every error shape the FBOS backend can emit into one structure.
// Shapes handled:
//   A. RFC 7807 problem (domain + gateway errors):
//        { code, title, detail: <string>, status, retryable, meta?, errors? }
//   B. FastAPI validation error (422): { detail: [ { loc, msg, type } ] }
//   C. Auth token error (get_current_user): { detail: { code, message, status } }
//   D. Raw FastAPI HTTPException: { detail: "<string>" }
//   E. Plain string body / anything else.
function parseErrorBody(payload, httpStatus) {
  const fallback = `Request failed (${httpStatus})`

  if (payload && typeof payload === 'object') {
    // A. RFC 7807 problem detail — has a top-level string `code`.
    if (typeof payload.code === 'string') {
      const fieldErrors = Array.isArray(payload.errors)
        ? payload.errors.map((e) => ({ field: e.field ?? null, issue: e.issue ?? e.msg ?? String(e) }))
        : null
      return {
        message: payload.detail || payload.title || payload.message || fallback,
        code: payload.code,
        title: payload.title,
        retryable: Boolean(payload.retryable),
        fieldErrors,
      }
    }

    // B. FastAPI validation error — `detail` is an array of {loc, msg}.
    if (Array.isArray(payload.detail)) {
      const fieldErrors = payload.detail.map((e) => ({
        field: Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null,
        issue: e.msg || 'Invalid value',
      }))
      const message =
        fieldErrors.map((f) => (f.field ? `${f.field}: ${f.issue}` : f.issue)).join('; ') || fallback
      return { message, code: 'VALIDATION_ERROR', retryable: false, fieldErrors }
    }

    // C. Token error dict — `detail` is an object with code/message.
    if (payload.detail && typeof payload.detail === 'object') {
      return {
        message: payload.detail.message || fallback,
        code: payload.detail.code,
        retryable: false,
        fieldErrors: null,
      }
    }

    // D. Raw HTTPException — `detail` is a string.
    if (typeof payload.detail === 'string') {
      return { message: payload.detail, retryable: false, fieldErrors: null }
    }

    // Fallback for objects exposing a message.
    if (typeof payload.message === 'string') {
      return { message: payload.message, code: payload.code, retryable: false, fieldErrors: null }
    }
  }

  // E. Plain string or empty.
  if (typeof payload === 'string' && payload.trim()) {
    return { message: payload, retryable: false, fieldErrors: null }
  }

  return { message: fallback, retryable: false, fieldErrors: null }
}

function uuidv4() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function request(method, path, { body, auth = true, headers = {} } = {}) {
  const finalHeaders = {
    Accept: 'application/json',
    'X-Request-Id': uuidv4(),
    ...headers,
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (auth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`

  let res
  try {
    res = await fetch(path, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (cause) {
    // fetch rejects on DNS/connection failures, CORS, or a dead dev proxy.
    throw new ApiError('Unable to reach the server.', {
      status: 0,
      code: 'NETWORK_ERROR',
      retryable: true,
      cause,
    })
  }

  if (res.status === 204) return null

  let payload = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!res.ok) {
    // An expired/invalid token on an authed call: let the auth layer tear down
    // the session (the route guard then redirects to /login).
    if (res.status === 401 && auth && accessToken && onUnauthorized) {
      onUnauthorized()
    }
    const parsed = parseErrorBody(payload, res.status)
    throw new ApiError(parsed.message, {
      status: res.status,
      code: parsed.code,
      title: parsed.title,
      retryable: parsed.retryable,
      fieldErrors: parsed.fieldErrors,
      details: payload,
    })
  }

  return payload
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  uuidv4,
}

// ---------- Auth endpoints ----------
export const authApi = {
  // The super-admin lives in `platform_admins` and has its own login endpoint
  // (no organization code, no MFA, access-token-only).
  login: ({ email, password }) =>
    api.post(`${IDENTITY}/auth/platform/login`, { email, password }, { auth: false }),

  me: () => api.get(`${IDENTITY}/auth/me`),

  logout: () => api.post(`${IDENTITY}/auth/logout`),
}

// ---------- Clients endpoints (platform-admin only) ----------
export const clientsApi = {
  list: ({ limit = 25, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return api.get(`${IDENTITY}/clients?${params.toString()}`)
  },

  get: (id) => api.get(`${IDENTITY}/clients/${id}`),

  create: (body) =>
    api.post(`${IDENTITY}/clients`, body, {
      headers: { 'Idempotency-Key': uuidv4() },
    }),

  update: (id, body) => api.patch(`${IDENTITY}/clients/${id}`, body),
}
