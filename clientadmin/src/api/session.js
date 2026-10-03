// Session manager: owns the access token and keeps it fresh with the refresh cookie.
//
// - The access token lives in memory only (never localStorage). The refresh token is an
//   HttpOnly cookie the browser sends itself; we only copy the readable CSRF cookie into
//   the X-CSRF-Token header.
// - refreshSession() is single-flight: any number of concurrent callers share one call.
// - Across tabs, refreshes run under a Web Lock. The backend rotates the refresh token on
//   every use and treats a replayed (already rotated) token as theft, revoking the whole
//   sign-in, so two tabs must never refresh with the same cookie at the same time.
// - New tokens and logouts are broadcast to the other tabs of this app.
// - The token is refreshed proactively at 80% of its lifetime, and when a sleeping tab
//   becomes visible again after that point.
//
// This file is identical in superadmin/ and clientadmin/; each app passes its endpoints
// and cookie names to configureSession().

let config = null
let accessToken = null
let generation = 0 // bumps on every token change (own refresh, login, or another tab)
let refreshAt = 0
let refreshTimer = null
let inflight = null
let channel = null
const listeners = new Set()

const PROACTIVE_RATIO = 0.8

export function configureSession({ refreshPath, logoutPath, csrfCookie, appKey }) {
  config = { refreshPath, logoutPath, csrfCookie, lockName: `${appKey}-refresh`, channelName: `${appKey}-auth` }
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(config.channelName)
    channel.onmessage = (event) => receive(event.data)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && accessToken && Date.now() >= refreshAt) {
        refreshSession().catch(() => {})
      }
    })
  }
}

export function getAccessToken() {
  return accessToken
}

// Listen for session changes: { type: 'login' | 'refresh' | 'logout', user?, remote }.
export function onSessionChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(event) {
  for (const fn of listeners) fn(event)
}

function schedule(expiresIn) {
  clearTimeout(refreshTimer)
  const ms = Math.max(5, (expiresIn || 900) * PROACTIVE_RATIO) * 1000
  refreshAt = Date.now() + ms
  refreshTimer = setTimeout(() => refreshSession().catch(() => {}), ms)
}

function store(token, expiresIn) {
  accessToken = token
  generation += 1
  schedule(expiresIn)
}

// Called after a successful login / MFA step.
export function startSession(tokenResponse) {
  store(tokenResponse.access_token, tokenResponse.expires_in)
  channel?.postMessage({ type: 'login', token: tokenResponse.access_token, expiresIn: tokenResponse.expires_in })
}

// Local teardown; `broadcast` also signs out the other tabs of this app.
export function endSession({ broadcast = true } = {}) {
  const hadSession = accessToken !== null
  accessToken = null
  generation += 1
  clearTimeout(refreshTimer)
  if (broadcast) channel?.postMessage({ type: 'logout' })
  if (hadSession || !broadcast) emit({ type: 'logout', remote: !broadcast })
}

function receive(message) {
  if (message?.type === 'logout') {
    endSession({ broadcast: false })
    return
  }
  if ((message?.type === 'login' || message?.type === 'refresh') && message.token) {
    const wasSignedOut = accessToken === null
    store(message.token, message.expiresIn)
    emit({ type: wasSignedOut ? 'login' : 'refresh', remote: true })
  }
}

function readCookie(name) {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

export class SessionExpiredError extends Error {
  constructor(code, status) {
    super('Your session has ended. Please sign in again.')
    this.name = 'SessionExpiredError'
    this.code = code || 'REFRESH_TOKEN_INVALID'
    this.status = status || 401
  }
}

async function callRefresh() {
  const csrf = readCookie(config.csrfCookie)
  let res
  try {
    res = await fetch(config.refreshPath, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Client-Type': 'browser',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
    })
  } catch {
    // Offline / server down: keep the session; the caller sees a network error.
    const err = new Error('Unable to reach the server.')
    err.code = 'NETWORK_ERROR'
    throw err
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const code = body?.code || body?.detail?.code
    // Only a definite "no valid session" ends it; a 5xx or 429 is transient.
    if (res.status === 401 || res.status === 403) {
      throw new SessionExpiredError(code, res.status)
    }
    const err = new Error(body?.detail || `Refresh failed (${res.status})`)
    err.code = code
    throw err
  }
  return body
}

/**
 * Get a fresh access token from the refresh cookie. Resolves with the token response
 * (for users it includes `user`); rejects with SessionExpiredError when the sign-in is
 * over, in which case the session is already torn down here.
 */
export function refreshSession() {
  if (!config) throw new Error('configureSession() was not called')
  if (inflight) return inflight

  const seenGeneration = generation
  const run = async () => {
    // Another tab refreshed while we waited for the lock and shared its token.
    if (generation !== seenGeneration && accessToken) return { access_token: accessToken, shared: true }
    try {
      const data = await callRefresh()
      store(data.access_token, data.expires_in)
      channel?.postMessage({ type: 'refresh', token: data.access_token, expiresIn: data.expires_in })
      emit({ type: 'refresh', user: data.user, remote: false })
      return data
    } catch (err) {
      if (err instanceof SessionExpiredError) endSession({ broadcast: true })
      throw err
    }
  }

  const locked = typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request(config.lockName, run)
    : run()
  inflight = locked.finally(() => {
    inflight = null
  })
  return inflight
}

// Revoke this sign-in on the server (works even with an expired access token, the
// server reads the refresh cookie), then tear down every tab.
export async function logoutSession() {
  try {
    await fetch(config.logoutPath, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Client-Type': 'browser',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })
  } catch {
    // Best effort: clear locally regardless.
  }
  endSession({ broadcast: true })
}
