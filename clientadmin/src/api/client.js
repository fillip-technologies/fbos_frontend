// Thin fetch wrapper around the FBOS Identity service.
// The browser always calls same-origin `/api/*`; the Vite dev proxy forwards to
// the backend (see vite.config.js), which sidesteps the missing CORS.

import { configureSession, endSession, getAccessToken, logoutSession, refreshSession, SessionExpiredError } from './session.js'

const IDENTITY = '/api/identity/v1'

// Client admins are regular users: refresh cookie `fbos_rt`, CSRF cookie `fbos_csrf`.
configureSession({
  refreshPath: `${IDENTITY}/auth/token/refresh`,
  logoutPath: `${IDENTITY}/auth/logout`,
  csrfCookie: 'fbos_csrf',
  appKey: 'fbos-clientadmin',
})

export { getAccessToken }

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

async function send(method, path, { body, auth, headers }) {
  const finalHeaders = {
    Accept: 'application/json',
    'X-Request-Id': uuidv4(),
    // Browser mode: the backend keeps the refresh token in an HttpOnly cookie.
    'X-Client-Type': 'browser',
    ...headers,
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`

  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
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
}

async function readPayload(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// The one place network calls go through. An authenticated call that gets 401 (access
// token expired or missing) refreshes the session once — shared with every other call
// that hit 401 at the same time — and is then replayed with the same headers, so an
// Idempotency-Key is reused. If the sign-in itself is over, the session is torn down
// and the route guard sends the user to /login.
async function request(method, path, { body, auth = true, headers = {} } = {}) {
  let res = await send(method, path, { body, auth, headers })

  if (res.status === 401 && auth) {
    try {
      await refreshSession()
    } catch (err) {
      const payload = await readPayload(res)
      const parsed = parseErrorBody(payload, res.status)
      throw new ApiError(err instanceof SessionExpiredError ? 'Your session has ended. Please sign in again.' : parsed.message, {
        status: 401,
        code: err instanceof SessionExpiredError ? err.code : parsed.code,
        details: payload,
      })
    }
    res = await send(method, path, { body, auth, headers })
  }

  if (res.status === 204) return null
  const payload = await readPayload(res)

  if (!res.ok) {
    const parsed = parseErrorBody(payload, res.status)
    // A subscription that ends mid-session answers 403 SUBSCRIPTION_EXPIRED: end the
    // session so the user lands on /login with the reason.
    if (auth && (res.status === 401 || (res.status === 403 && parsed.code === 'SUBSCRIPTION_EXPIRED'))) {
      endSession()
    }
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
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
  uuidv4,
}

// ---------- Auth endpoints ----------
export const authApi = {
  // Client admins sign in through the regular user login. `organization_code` is only
  // needed when the same email exists in more than one organization.
  login: ({ email, password, organization_code }) => {
    const body = { email, password }
    if (organization_code) body.organization_code = organization_code
    return api.post(`${IDENTITY}/auth/login`, body, { auth: false })
  },

  verifyMfa: ({ mfa_token, code }) =>
    api.post(`${IDENTITY}/auth/mfa/verify`, { mfa_token, code }, { auth: false }),

  me: () => api.get(`${IDENTITY}/auth/me`),

  // Revokes this sign-in server-side (works even after the access token expired) and
  // signs every open tab out.
  logout: () => logoutSession(),

  // Restores a session from the refresh cookie (page load). Resolves with { access_token, user }.
  restore: () => refreshSession(),

  forgotPassword: ({ email, organization_code }) => {
    const body = { email }
    if (organization_code) body.organization_code = organization_code
    return api.post(`${IDENTITY}/auth/password/forgot`, body, { auth: false })
  },

  resetPassword: ({ token, new_password }) =>
    api.post(`${IDENTITY}/auth/password/reset`, { token, new_password }, { auth: false }),

  acceptInvitation: ({ token, password }) =>
    api.post(`${IDENTITY}/auth/invitations/accept`, { token, password }, { auth: false }),
}

// ---------- The caller's own client: subscription window + quotas (read-only) ----------
export const clientApi = {
  me: () => api.get(`${IDENTITY}/clients/me`),
}

function pageQuery({ limit = 25, cursor, ...rest } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  for (const [k, v] of Object.entries(rest)) if (v) params.set(k, v)
  return params.toString()
}

// ---------- Organizations (client-admin only; always scoped to the caller's client) ----------
export const organizationsApi = {
  list: (opts) => api.get(`${IDENTITY}/organizations?${pageQuery(opts)}`),
  get: (id) => api.get(`${IDENTITY}/organizations/${id}`),
  create: (body) =>
    api.post(`${IDENTITY}/organizations`, body, { headers: { 'Idempotency-Key': uuidv4() } }),
  update: (id, body) => api.patch(`${IDENTITY}/organizations/${id}`, body),
}

// ---------- Organization-scoped endpoints ----------
// A client admin may act in any organization of their client: every call below takes the
// organization id and sends it as `X-Organization-Id` (omitted -> the admin's own org).
const inOrg = (orgId, headers = {}) => (orgId ? { ...headers, 'X-Organization-Id': orgId } : headers)

// Walks cursor pagination for small catalogs (units, roles, permissions).
async function listAll(path, orgId, params = {}) {
  const items = []
  let cursor
  do {
    const page = await api.get(`${path}?${pageQuery({ limit: 100, cursor, ...params })}`, { headers: inOrg(orgId) })
    items.push(...page.data)
    cursor = page.page?.has_more ? page.page.next_cursor : null
  } while (cursor)
  return items
}

// ---------- Users ----------
export const usersApi = {
  list: (orgId, opts) => api.get(`${IDENTITY}/users?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  get: (orgId, id) => api.get(`${IDENTITY}/users/${id}`, { headers: inOrg(orgId) }),
  invite: (orgId, body) =>
    api.post(`${IDENTITY}/users`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  update: (orgId, id, version, body) =>
    api.patch(`${IDENTITY}/users/${id}`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  deactivate: (orgId, id, version, body) =>
    api.post(`${IDENTITY}/users/${id}/deactivate`, body, { headers: inOrg(orgId, { 'If-Match': `"${version}"` }) }),
  resendInvitation: (orgId, id) => api.post(`${IDENTITY}/users/${id}/invitations`, undefined, { headers: inOrg(orgId) }),
  permissions: (orgId, id) => api.get(`${IDENTITY}/users/${id}/permissions`, { headers: inOrg(orgId) }),
  replacePermissions: (orgId, id, body) =>
    api.put(`${IDENTITY}/users/${id}/permissions`, body, { headers: inOrg(orgId) }),
  roleAssignments: (orgId, userId) => listAll(`${IDENTITY}/role-assignments`, orgId, { user_id: userId }),
}

// ---------- Access catalog: permissions, roles (presets), org units ----------
export const accessApi = {
  permissions: (orgId) => listAll(`${IDENTITY}/permissions`, orgId),
  roles: (orgId) => listAll(`${IDENTITY}/roles`, orgId),
  createRole: (orgId, body) =>
    api.post(`${IDENTITY}/roles`, body, { headers: inOrg(orgId, { 'Idempotency-Key': uuidv4() }) }),
  replaceRolePermissions: (orgId, roleId, version, permissions) =>
    api.put(`${IDENTITY}/roles/${roleId}/permissions`, { permissions }, {
      headers: inOrg(orgId, { 'If-Match': `"${version}"` }),
    }),
  orgUnits: (orgId) => listAll(`${IDENTITY}/org-units`, orgId, { status: 'active' }),
}
