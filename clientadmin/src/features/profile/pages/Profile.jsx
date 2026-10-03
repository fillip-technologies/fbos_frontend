import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { authApi } from '@/features/auth/api.js'
import { friendlyMessage } from '@/shared/api/errors.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { formatDateTime, USER_TYPE_LABELS } from '@/features/users/utils.js'

function Detail({ label, children }) {
  return (
    <div className="detail">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// The signed-in user's own account: who they are, password reset, and two-factor sign-in.
export default function Profile() {
  const { user } = useAuth()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Your own account and how you sign in.</p>
        </div>
      </div>

      <div className="panel form-section">
        <h2>Account</h2>
        <div className="details-grid">
          <Detail label="Name">{user.name}</Detail>
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Role">{USER_TYPE_LABELS[user.user_type] || user.user_type}</Detail>
          <Detail label="Organization">{user.organization && `${user.organization.name} (${user.organization.code})`}</Detail>
          <Detail label="Home unit">{user.home_unit?.name}</Detail>
          <Detail label="Timezone">{user.timezone}</Detail>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Your name and email are managed by the platform administrator. Ask them if something here is wrong.
        </p>
      </div>

      <PasswordSection user={user} />
      <TwoFactorSection />
    </div>
  )
}

// There is no "change password while signed in" endpoint, so this sends the standard
// reset link to the user's own email.
function PasswordSection({ user }) {
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  async function send() {
    setError(null)
    setState('sending')
    try {
      await authApi.forgotPassword({ email: user.email, organization_code: user.organization?.code })
      setState('sent')
    } catch (err) {
      setError(err)
      setState('idle')
    }
  }

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>Password</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            We email you a link to choose a new password. The link is valid for a limited time.
          </p>
        </div>
        {state !== 'sent' && (
          <button className="btn secondary" onClick={send} disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a reset link'}
          </button>
        )}
      </div>
      {state === 'sent' && <div className="alert success" style={{ marginBottom: 0 }}>Check {user.email} for the reset link. If it doesn't arrive in a few minutes, look in your spam folder.</div>}
      {error && <div className="alert error" style={{ marginBottom: 0 }}>{friendlyMessage(error)}</div>}
    </div>
  )
}

// Steps: off -> scanning (QR + first code) -> codes (show recovery codes once) -> on.
function TwoFactorSection() {
  const { user, reloadUser } = useAuth()
  const [step, setStep] = useState(user.mfa_enabled ? 'on' : 'off')
  const [enrollment, setEnrollment] = useState(null) // { otpauth_uri, expires_at, qr, secret }
  const [codes, setCodes] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user.mfa_enabled && step === 'off') setStep('on')
  }, [user.mfa_enabled, step])

  async function start() {
    setError(null)
    setBusy(true)
    try {
      const res = await authApi.startMfaEnrollment()
      // The backend's qr_png_data_url is a placeholder, so the QR is drawn here from the URI.
      const qr = await QRCode.toDataURL(res.otpauth_uri, { width: 220, margin: 1 })
      const secret = new URL(res.otpauth_uri).searchParams.get('secret') || ''
      setEnrollment({ ...res, qr, secret })
      setStep('scanning')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function confirmed(recoveryCodes) {
    setCodes(recoveryCodes)
    setEnrollment(null)
    setStep('codes')
    await reloadUser().catch(() => {})
  }

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>Two-factor sign-in</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            After your password, sign-in also asks for a 6-digit code from an authenticator app on your phone
            (Google Authenticator, Microsoft Authenticator, Authy…).
          </p>
        </div>
        {step === 'on' && <span className="badge active">Enabled</span>}
        {step === 'off' && <span className="badge inactive">Off</span>}
      </div>

      {error && <div className="alert error">{friendlyMessage(error)}</div>}

      {step === 'off' && (
        <button className="btn" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Set up two-factor sign-in'}</button>
      )}

      {step === 'scanning' && enrollment && (
        <ScanStep enrollment={enrollment} onCancel={() => { setEnrollment(null); setStep('off') }} onRestart={start} onConfirmed={confirmed} />
      )}

      {step === 'codes' && <RecoveryCodes codes={codes} email={user.email} onDone={() => setStep('on')} />}

      {step === 'on' && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Two-factor sign-in is on. It can't be turned off or moved to a new phone from here yet, so keep your
          authenticator app (and your recovery codes) safe.
        </p>
      )}
    </div>
  )
}

function ScanStep({ enrollment, onCancel, onRestart, onConfirmed }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const expired = new Date(enrollment.expires_at) < new Date()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await authApi.confirmMfaEnrollment(code)
      await onConfirmed(res.codes)
    } catch (err) {
      setError(err)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mfa-setup">
      <ol className="mfa-steps">
        <li>
          <strong>Scan this QR code</strong> with your authenticator app.
          <div className="mfa-qr">
            <img src={enrollment.qr} width={220} height={220} alt="QR code for your authenticator app" />
          </div>
          {enrollment.secret && (
            <div className="muted small">
              Can't scan? Enter this key manually: <code className="mfa-secret">{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </div>
          )}
        </li>
        <li>
          <strong>Enter the 6-digit code</strong> the app shows for “FBOS”.
          <form onSubmit={submit} className="mfa-confirm">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label="6-digit code"
              autoFocus
              required
            />
            <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Turn on'}</button>
            <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
          </form>
          {error && <div className="alert error" style={{ marginTop: 10 }}>{friendlyMessage(error)}</div>}
          <div className="hint muted small">
            {expired ? (
              <>This setup has expired. <button type="button" className="link-btn" onClick={onRestart}>Start again</button></>
            ) : (
              `Finish before ${formatDateTime(enrollment.expires_at)}.`
            )}
          </div>
        </li>
      </ol>
    </div>
  )
}

function RecoveryCodes({ codes, email, onDone }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `FBOS recovery codes for ${email}\n\n${codes.join('\n')}\n`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'fbos-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="alert success">Two-factor sign-in is now on.</div>
      <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Save your recovery codes</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        This is the only time they are shown. Store them somewhere safe, such as a password manager.
      </p>
      <div className="recovery-codes mono">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="row-actions" style={{ margin: '10px 0 14px' }}>
        <button className="btn secondary" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn secondary" type="button" onClick={download}>Download .txt</button>
      </div>
      <label className="inline-check" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I've saved these codes
      </label>
      <div>
        <button className="btn" onClick={onDone} disabled={!saved}>Done</button>
      </div>
    </div>
  )
}
