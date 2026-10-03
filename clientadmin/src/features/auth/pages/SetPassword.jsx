import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/features/auth/api.js'
import { friendlyMessage } from '@/shared/api/errors.js'

const MODES = {
  invite: {
    title: 'Activate your account',
    sub: 'Choose a password to finish setting up your account.',
    button: 'Activate account',
    done: 'Your account is active. Sign in with your new password.',
    call: (token, password) => authApi.acceptInvitation({ token, password }),
  },
  reset: {
    title: 'Choose a new password',
    sub: 'Enter a new password for your account.',
    button: 'Update password',
    done: 'Password updated. Sign in with your new password.',
    call: (token, password) => authApi.resetPassword({ token, new_password: password }),
  },
}

// One screen for both email links: /accept-invitation?token=… and /reset-password?token=…
export default function SetPassword({ mode }) {
  const cfg = MODES[mode]
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tooShort = password.length > 0 && password.length < 12
  const mismatch = confirm.length > 0 && confirm !== password

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 12) return setError('Password must be at least 12 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      await cfg.call(token.trim(), password)
      navigate('/login', { replace: true, state: { notice: cfg.done } })
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <h1>{cfg.title}</h1>
        <p className="sub">{cfg.sub}</p>
        {error && <div className="alert error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!params.get('token') && (
            <div className="field">
              <label htmlFor="token">Token</label>
              <input id="token" className="mono" value={token} onChange={(e) => setToken(e.target.value)} required />
              <div className="hint">Paste the token from your email.</div>
            </div>
          )}
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className={tooShort ? 'invalid' : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className={tooShort ? 'field-error' : 'hint'}>At least 12 characters.</div>
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              className={mismatch ? 'invalid' : ''}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {mismatch && <div className="field-error">Passwords do not match.</div>}
          </div>
          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Saving…' : cfg.button}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
