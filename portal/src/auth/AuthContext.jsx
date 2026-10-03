import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  authApi,
  hasSessionCookie,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from '../api/client.js'

// Which console the user signed into. Tokens never touch storage (the refresh
// token is an HttpOnly cookie, the access token stays in memory), so this is
// the only thing persisted.
const STORAGE_KEY = 'fbos_portal_console'
const AuthContext = createContext(null)

export const CONSOLE = {
  CLIENT: 'client',
  ORGANIZATION: 'organization',
}

// Client sign-in is for client admins only (the backend gates every
// /organizations route behind require_client_admin). Organization sign-in is
// for any member of an organization, client admins included.
function allowedIn(consoleType, user) {
  if (!user) return false
  if (consoleType === CONSOLE.CLIENT) return user.user_type === 'client_admin'
  if (consoleType === CONSOLE.ORGANIZATION) return Boolean(user.organization)
  return false
}

export class WrongConsoleError extends Error {
  constructor(consoleType) {
    super(
      consoleType === CONSOLE.CLIENT
        ? 'This account is not a client administrator. Use Organization sign-in instead.'
        : 'This account does not belong to an organization.'
    )
    this.name = 'WrongConsoleError'
  }
}

function readStoredConsole() {
  const value = localStorage.getItem(STORAGE_KEY)
  return Object.values(CONSOLE).includes(value) ? value : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [consoleType, setConsoleType] = useState(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setConsoleType(null)
  }, [])

  // When a call 401s and a refresh can't recover it, drop the session; the
  // route guard then redirects to /login.
  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    return () => setSessionExpiredHandler(null)
  }, [clearSession])

  // Restore after a reload: rotate the refresh cookie into a new access token.
  // StrictMode runs this twice in dev; refreshSession() shares one request.
  useEffect(() => {
    let cancelled = false
    const stored = readStoredConsole()
    if (!stored || !hasSessionCookie()) {
      localStorage.removeItem(STORAGE_KEY)
      setLoading(false)
      return
    }
    refreshSession()
      .then(async (resp) => {
        const me = resp.user ?? (await authApi.me())
        if (cancelled) return
        if (allowedIn(stored, me)) {
          setUser(me)
          setConsoleType(stored)
        } else {
          clearSession()
        }
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clearSession])

  // Establishes the session from a completed login (or MFA) token response,
  // enforcing that the account fits the chosen console before we trust it.
  const establish = useCallback(
    async (tokenResponse, chosenConsole) => {
      const token = tokenResponse.access_token
      if (!token) throw new ApiError('No access token returned', { status: 500 })
      setAccessToken(token)
      const me = tokenResponse.user ?? (await authApi.me())
      if (!allowedIn(chosenConsole, me)) {
        // The backend already opened a session and set the refresh cookie: close it.
        try {
          await authApi.logout()
        } catch {
          // best-effort; clear locally regardless
        }
        clearSession()
        throw new WrongConsoleError(chosenConsole)
      }
      localStorage.setItem(STORAGE_KEY, chosenConsole)
      setUser(me)
      setConsoleType(chosenConsole)
      return me
    },
    [clearSession]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // best-effort; clear locally regardless
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ user, consoleType, loading, establish, logout, isAuthenticated: !!user }),
    [user, consoleType, loading, establish, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
