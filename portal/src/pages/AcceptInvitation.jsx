import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client.js'
import ErrorBanner from '../components/ErrorBanner.jsx'

// Mirrors the backend rule in auth_service.accept_invitation.
const MIN_PASSWORD_LENGTH = 12

// Invited users (a client's first admin, or an organization's) have no password
// until they redeem their invitation token here. The token arrives as
// /accept-invitation?token=… or can be pasted in.
export default function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const mismatch = confirm.length > 0 && confirm !== password

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) return
    setError(null)
    setSubmitting(true)
    try {
      await authApi.acceptInvitation({ token: token.trim(), password })
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <h1>Accept invitation</h1>
        <p className="sub">Set a password to activate your FBOS account.</p>

        {done ? (
          <>
            <div className="alert success">Your password is set. You can sign in now.</div>
            <Link className="btn" to="/login" style={{ width: '100%' }}>
              Client sign-in
            </Link>
            <Link className="btn secondary" to="/login?as=organization" style={{ width: '100%', marginTop: 8 }}>
              Organization sign-in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <ErrorBanner error={error} />
            <div className="field">
              <label htmlFor="token">Invitation token</label>
              <input
                id="token"
                className="mono"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="inv_…"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="hint">At least {MIN_PASSWORD_LENGTH} characters.</div>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                className={mismatch ? 'invalid' : ''}
                aria-invalid={mismatch}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {mismatch && <div className="field-error">Passwords do not match.</div>}
            </div>
            <button className="btn" type="submit" disabled={submitting || mismatch} style={{ width: '100%' }}>
              {submitting ? 'Activating…' : 'Set password'}
            </button>
          </form>
        )}

        <p className="auth-foot muted">
          Already active? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
