import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi, ApiError } from '../api/client.js'
import { friendlyMessage } from '../api/errors.js'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { establish } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/clients'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [showOrgCode, setShowOrgCode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // MFA challenge branch: login can return { status: 'mfa_required', mfa_token }.
  const [mfa, setMfa] = useState(null) // { mfa_token }
  const [mfaCode, setMfaCode] = useState('')

  async function finish(tokenResponse) {
    await establish(tokenResponse)
    navigate(redirectTo, { replace: true })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const resp = await authApi.login({
        email: email.trim(),
        password,
        organization_code: orgCode.trim() || undefined,
      })
      if (resp.status === 'mfa_required') {
        setMfa({ mfa_token: resp.mfa_token })
        return
      }
      await finish(resp)
    } catch (err) {
      // Reveal the org-code field automatically when the email is ambiguous.
      if (err instanceof ApiError && err.code === 'ORGANIZATION_AMBIGUOUS') {
        setShowOrgCode(true)
      }
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
      const resp = await authApi.verifyMfa({ mfa_token: mfa.mfa_token, code: mfaCode.trim() })
      await finish(resp)
    } catch (err) {
      // An expired mfa_token means the whole challenge must restart.
      if (err instanceof ApiError && err.code === 'MFA_TOKEN_EXPIRED') {
        setMfa(null)
        setMfaCode('')
      }
      setError(friendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <h1>Super Admin</h1>
        <p className="sub">FBOS Platform — Clients management console</p>

        {error && <div className="alert error" role="alert">{error}</div>}

        {!mfa ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@fbos.platform"
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

            {showOrgCode ? (
              <div className="field">
                <label htmlFor="orgCode">Organization code</label>
                <input
                  id="orgCode"
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  placeholder="PLATFORM"
                  autoFocus
                />
                <div className="hint">Required because this email exists in more than one organization.</div>
              </div>
            ) : (
              <div className="field">
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  onClick={() => setShowOrgCode(true)}
                >
                  Add organization code
                </button>
              </div>
            )}

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
                setError('')
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
