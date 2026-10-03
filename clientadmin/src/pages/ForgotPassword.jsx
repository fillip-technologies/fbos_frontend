import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client.js'
import { friendlyMessage } from '../api/errors.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authApi.forgotPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(friendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <h1>Reset password</h1>
        <p className="sub">We'll email you a reset link.</p>
        {error && <div className="alert error" role="alert">{error}</div>}
        {sent ? (
          // Same message whether or not the account exists, so emails can't be probed.
          <div className="alert success">If an account exists for that email, a reset link is on its way.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
