import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { authApi, ApiError } from '../api/client.js'
import { endSession, onSessionChange, startSession } from '../api/session.js'

// Older builds kept the access token here; it now lives in memory only.
const LEGACY_STORAGE_KEY = 'fbos_clientadmin_session'
const AuthContext = createContext(null)

// Only client admins may use this console; the backend gates every /organizations
// route behind require_client_admin, so we mirror that check client-side.
function isClientAdmin(user) {
  return user?.user_type === 'client_admin'
}

export class NotClientAdminError extends Error {
  constructor() {
    super('This console is for client administrators only.')
    this.name = 'NotClientAdminError'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the HttpOnly refresh cookie: a reload or a new tab stays
  // signed in for as long as the refresh token lives (30 days, rotated on every use).
  useEffect(() => {
    let cancelled = false
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    authApi
      .restore()
      .then(async (session) => {
        const me = session.user ?? (await authApi.me())
        if (cancelled) return
        if (isClientAdmin(me)) setUser(me)
        else endSession()
      })
      .catch(() => {
        /* no session (or it ended): show the sign-in page */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep React state in line with the session manager: sign-outs (here, in another tab,
  // or because the refresh token died) and sign-ins done in another tab.
  useEffect(
    () =>
      onSessionChange((event) => {
        if (event.type === 'logout') setUser(null)
        else if (event.user && isClientAdmin(event.user)) setUser(event.user)
        else if (event.type === 'login' && event.remote) {
          authApi.me().then((me) => isClientAdmin(me) && setUser(me)).catch(() => {})
        }
      }),
    []
  )

  // Establishes the session from a completed login / MFA token response.
  const establish = useCallback(async (tokenResponse) => {
    if (!tokenResponse.access_token) throw new ApiError('No access token returned', { status: 500 })
    startSession(tokenResponse)
    const me = tokenResponse.user ?? (await authApi.me())
    if (!isClientAdmin(me)) {
      await authApi.logout()
      throw new NotClientAdminError()
    }
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  // Re-reads /auth/me after the user changes something about their own account (e.g. MFA).
  const reloadUser = useCallback(async () => {
    const me = await authApi.me()
    if (isClientAdmin(me)) setUser(me)
    return me
  }, [])

  const value = useMemo(
    () => ({ user, loading, establish, logout, reloadUser, isAuthenticated: !!user }),
    [user, loading, establish, logout, reloadUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
