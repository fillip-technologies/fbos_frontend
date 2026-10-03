import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, ApiError } from '../api/client.js'
import { friendlyMessage } from '../api/errors.js'
import { CONSOLE, useAuth } from '../auth/AuthContext.jsx'

const TABS = [
  {
    id: CONSOLE.CLIENT,
    label: 'Client',
    sub: 'For client administrators — manage your organizations.',
  },
  {
    id: CONSOLE.ORGANIZATION,
    label: 'Organization',
    sub: 'For members of an organization. Ask your administrator for the organization code.',
  },
]

export default function Login() {
  const { establish, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const redirectTo = location.state?.from?.pathname || '/'

  const [consoleType, setConsoleType] = useState(
    searchParams.get('as') === CONSOLE.ORGANIZATION ? CONSOLE.ORGANIZATION : CONSOLE.CLIENT
  )
  const [orgCode, setOrgCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // MFA challenge branch: login can return { status: 'mfa_required', mfa_token }.
  const [mfa, setMfa] = useState(null) // { mfa_token }
  const [mfaCode, setMfaCode] = useState('')

  if (isAuthenticated) return <Navigate to="/" replace />

  const tab = TABS.find((t) => t.id === consoleType)
  const isOrganization = consoleType === CONSOLE.ORGANIZATION

  function switchTab(id) {
    setConsoleType(id)
    setError(null)
  }

  // A wrong organization code is indistinguishable from a wrong password on
  // purpose (the backend answers INVALID_CREDENTIALS for both), so say so.
  function errorMessage(err) {
    if (isOrganization && err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
      return 'Invalid organization code, email or password.'
    }
    return friendlyMessage(err)
  }

  async function finish(tokenResponse) {
    await establish(tokenResponse, consoleType)
    navigate(redirectTo, { replace: true })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const resp = await authApi.login({
        email: email.trim(),
        password,
        organization_code: isOrganization ? orgCode.trim() : undefined,
      })
      if (resp.status === 'mfa_required') {
        setMfa({ mfa_token: resp.mfa_token })
        return
      }
      await finish(resp)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfa(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const resp = await authApi.verifyMfa({ mfa_token: mfa.mfa_token, code: mfaCode.trim() })
      await finish(resp)
    } catch (err) {
      // An expired mfa_token means the whole challenge must restart.
      if (err instanceof ApiError && err.code === 'MFA_TOKEN_EXPIRED') {
        setMfa(null)
        setMfaCode('')
      }
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <h1>Sign in</h1>
        <p className="sub">FBOS Portal</p>

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={consoleType === t.id}
              className={`tab${consoleType === t.id ? ' active' : ''}`}
              onClick={() => switchTab(t.id)}
              disabled={!!mfa}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted tab-sub">{tab.sub}</p>

        {error && (
          <div className="alert error" role="alert">
            {errorMessage(error)}
            {error instanceof ApiError && error.code === 'ACCOUNT_NOT_ACTIVE' && (
              <>
                {' '}
                <Link to="/accept-invitation">Accept your invitation</Link>
              </>
            )}
          </div>
        )}

        {!mfa ? (
          <form onSubmit={handleLogin}>
            {isOrganization && (
              <div className="field">
                <label htmlFor="orgCode">Organization code</label>
                <input
                  id="orgCode"
                  name="organization_code"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                  placeholder="ACME-IN"
                  required
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfa}>
            <div className="alert info">Enter the 6-digit code from your authenticator app.</div>
            <div className="field">
              <label htmlFor="mfaCode">Authentication code</label>
              <input
                id="mfaCode"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                autoFocus
                required
              />
            </div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                setMfa(null)
                setMfaCode('')
                setError(null)
              }}
            >
              Back
            </button>
          </form>
        )}

        <p className="auth-foot muted">
          Invited? <Link to="/accept-invitation">Set your password</Link>
        </p>
      </div>
    </div>
  )
}
