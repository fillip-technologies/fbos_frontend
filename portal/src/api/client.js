// Thin fetch wrapper around the FBOS Identity service.
// The browser always calls same-origin `/api/*`; the Vite dev proxy forwards to
// the backend (see vite.config.js), which sidesteps the missing CORS.
//
// Session model: /auth/login sets an HttpOnly refresh-token cookie (`fbos_rt`)
// plus a readable CSRF cookie (`fbos_csrf`). The short-lived (15 min) access
// token lives only in memory. When it expires (any 401) — or after a page
// reload — we rotate it via /auth/token/refresh with the double-submit
// `X-CSRF-Token` header.

const IDENTITY = '/api/identity/v1'
const CSRF_COOKIE = 'fbos_csrf'

// Makes the backend treat us as a browser (refresh token in the HttpOnly
// cookie, never in the response body) instead of guessing from headers.
const BROWSER_CLIENT = { 'X-Client-Type': 'browser' }

let accessToken = null
let onSessionExpired = null
let refreshInFlight = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

// Registered by the auth layer: invoked when an authenticated call gets a 401
// that a token refresh could not fix, so the session can be cleared.
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn
}

function readCookie(name) {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const cookie = part.trim()
    if (cookie.startsWith(prefix)) return decodeURIComponent(cookie.slice(prefix.length))
  }
  return null
}

// The refresh cookie itself is HttpOnly; its CSRF twin is how we can tell that
// this browser may still hold a session worth restoring.
export function hasSessionCookie() {
  return readCookie(CSRF_COOKIE) !== null
}

// Raised for any non-2xx response (and network failures).
// Carries the backend error `code` plus normalized extras so the UI can react:
//   - code:        machine code, e.g. "ORGANIZATION_CODE_EXISTS", "VALIDATION_ERROR", "NETWORK_ERROR"
//   - title:       short human title (RFC 7807 problem responses)
//   - retryable:   backend hint that retrying may succeed (503/504/429/network)
//   - fieldErrors: [{ field, issue }] for form-level validation/conflict display
//   - details:     the raw response body (e.g. `meta` for quota errors)
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

// Rotates the refresh cookie into a new access token. Concurrent callers (a
// burst of 401s, or StrictMode running the restore effect twice) share ONE
// request: the backend treats a reused refresh token as theft and revokes the
// whole session, so two parallel refreshes would sign the user out.
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      // Read fresh every time — the CSRF cookie rotates on each refresh.
      const csrf = readCookie(CSRF_COOKIE)
      if (!csrf) {
        throw new ApiError('No active session.', { status: 401, code: 'REFRESH_TOKEN_INVALID' })
      }
      const resp = await request('POST', `${IDENTITY}/auth/token/refresh`, {
        auth: false,
        headers: { ...BROWSER_CLIENT, 'X-CSRF-Token': csrf },
      })
      accessToken = resp.access_token
      return resp
    })()
      .catch((err) => {
        accessToken = null
        throw err
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function request(method, path, { body, auth = true, headers = {}, retryOn401 = true } = {}) {
  const sentToken = auth ? accessToken : null
  const finalHeaders = {
    Accept: 'application/json',
    'X-Request-Id': uuidv4(),
    ...headers,
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (sentToken) finalHeaders.Authorization = `Bearer ${sentToken}`

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
    // An expired access token on an authed call: refresh once and replay. If a
    // concurrent call already rotated the token, just replay with the new one.
    if (res.status === 401 && auth) {
      if (retryOn401) {
        let refreshed = true
        if (accessToken === sentToken) {
          try {
            await refreshSession()
          } catch {
            refreshed = false
          }
        }
        if (refreshed && accessToken) {
          return request(method, path, { body, auth, headers, retryOn401: false })
        }
      }
      // Refresh failed (or the replay was rejected too): the session is over and
      // the route guard will redirect to /login.
      if (onSessionExpired) onSessionExpired()
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
  // One endpoint for client admins and organization users alike. With
  // organization_code, the backend only accepts a user of that organization.
  login: ({ email, password, organization_code }) =>
    api.post(
      `${IDENTITY}/auth/login`,
      { email, password, ...(organization_code ? { organization_code } : {}) },
      { auth: false, headers: BROWSER_CLIENT }
    ),

  verifyMfa: ({ mfa_token, code }) =>
    api.post(`${IDENTITY}/auth/mfa/verify`, { mfa_token, code }, { auth: false, headers: BROWSER_CLIENT }),

  acceptInvitation: ({ token, password }) =>
    api.post(`${IDENTITY}/auth/invitations/accept`, { token, password }, { auth: false }),

  me: () => api.get(`${IDENTITY}/auth/me`),

  // Revokes the refresh-token family and clears the session cookies.
  logout: () => api.post(`${IDENTITY}/auth/logout`),
}

// ---------- Organizations endpoints (client-admin only, scoped to their client) ----------
export const organizationsApi = {
  list: ({ limit = 25, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return api.get(`${IDENTITY}/organizations?${params.toString()}`)
  },

  get: (id) => api.get(`${IDENTITY}/organizations/${id}`),

  create: (body) =>
    api.post(`${IDENTITY}/organizations`, body, {
      headers: { 'Idempotency-Key': uuidv4() },
    }),

  update: (id, body) => api.patch(`${IDENTITY}/organizations/${id}`, body),
}

// ---------- Users endpoints (scoped to the caller's own organization) ----------
export const usersApi = {
  list: ({ limit = 25, cursor, q, status } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    return api.get(`${IDENTITY}/users?${params.toString()}`)
  },
}
