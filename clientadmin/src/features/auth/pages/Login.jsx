import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '@/shared/api/http.js'
import { authApi } from '@/features/auth/api.js'
import { friendlyMessage } from '@/shared/api/errors.js'
import AuthFrame from '@/shared/components/AuthFrame.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'

export default function Login() {
  const { establish } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/'
  const notice = location.state?.notice

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [needsOrgCode, setNeedsOrgCode] = useState(false)
  const [mfaToken, setMfaToken] = useState(null)
  const [code, setCode] = useState('')
  // Without the authenticator, one of the recovery codes shown when two-factor sign-in was turned on (each works once).
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function finish(resp) {
    await establish(resp)
    navigate(redirectTo, { replace: true })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const resp = await authApi.login({ email: email.trim(), password, organization_code: orgCode.trim() })
      if (resp.status === 'mfa_required') {
        setMfaToken(resp.mfa_token)
        return
      }
      await finish(resp)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ORGANIZATION_AMBIGUOUS') setNeedsOrgCode(true)
      setError(friendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfa(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await finish(await authApi.verifyMfa({ mfa_token: mfaToken, code: code.trim() }))
    } catch (err) {
      setError(friendlyMessage(err))
      if (err instanceof ApiError && err.code === 'MFA_TOKEN_EXPIRED') {
        setMfaToken(null)
        setCode('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <div className="panel auth-card">
        <h1>Welcome back</h1>
        <p className="sub">Sign in with your work email. What you can manage depends on your access.</p>

        {notice && <div className="alert success">{notice}</div>}
        {error && <div className="alert error" role="alert">{error}</div>}

        {mfaToken ? (
          <form onSubmit={handleMfa}>
            <div className="field">
              <label htmlFor="code">{useRecoveryCode ? 'Recovery code' : 'Verification code'}</label>
              <input
                id="code"
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                autoComplete={useRecoveryCode ? 'off' : 'one-time-code'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={useRecoveryCode ? 'ABCDE-FGHJK' : '6-digit code'}
                required
                autoFocus
              />
              <div className="hint">
                {useRecoveryCode
                  ? 'Enter one of the recovery codes you saved. Each one works once.'
                  : 'Enter the code from your authenticator app.'}
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => { setUseRecoveryCode((on) => !on); setCode('') }}
              >
                {useRecoveryCode ? 'Use the authenticator app instead' : 'Lost your phone? Use a recovery code'}
              </button>
              {useRecoveryCode && (
                <div className="hint">No recovery codes left? Ask an administrator to turn off two-factor sign-in for you.</div>
              )}
            </div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
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
            {needsOrgCode && (
              <div className="field">
                <label htmlFor="org">Company code</label>
                <input id="org" value={orgCode} onChange={(e) => setOrgCode(e.target.value.toUpperCase())} required />
                <div className="hint">This email exists in more than one company.</div>
              </div>
            )}
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="auth-links">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </form>
        )}
      </div>
    </AuthFrame>
  )
}
