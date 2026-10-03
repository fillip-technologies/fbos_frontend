import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '@/features/auth/api.js'
import { friendlyMessage } from '@/shared/api/errors.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

export default function Login() {
  const { establish } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/clients'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const resp = await authApi.login({ email: email.trim(), password })
      await establish(resp)
      navigate(redirectTo, { replace: true })
    } catch (err) {
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

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
