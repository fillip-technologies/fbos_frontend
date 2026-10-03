import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { organizationsApi } from '../../api/client.js'
import { friendlyMessage, getFieldErrors } from '../../api/errors.js'
import ErrorBanner from '../../components/ErrorBanner.jsx'

// Mirrors OrganizationCreateRequest in the Identity service. The owning client
// comes from the signed-in client admin's token, never the body. When
// admin_email is given the backend invites the org's first admin.
const INITIAL = {
  name: '',
  code: '',
  email: '',
  admin_email: '',
  admin_name: '',
  base_currency: 'INR',
  fiscal_year_start: '04-01',
  timezone: 'Asia/Kolkata',
}

export default function OrganizationCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Field-level errors: validation (422) issues plus a manual mapping for the
  // conflict domain errors, which have no field attached on the backend.
  const fieldErrors = { ...getFieldErrors(error) }
  if (error && (error.code === 'ORGANIZATION_CODE_EXISTS' || error.code === 'DUPLICATE_CODE')) {
    fieldErrors.code = friendlyMessage(error)
  }
  if (error && error.code === 'EMAIL_ALREADY_EXISTS') {
    fieldErrors.admin_email = friendlyMessage(error)
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // The backend has no defaults for currency / fiscal year / timezone.
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        email: form.email.trim(),
        base_currency: form.base_currency.trim() || 'INR',
        fiscal_year_start: form.fiscal_year_start.trim() || '04-01',
        timezone: form.timezone.trim() || 'Asia/Kolkata',
      }
      if (form.admin_email.trim()) body.admin_email = form.admin_email.trim()
      if (form.admin_name.trim()) body.admin_name = form.admin_name.trim()

      const created = await organizationsApi.create(body)
      navigate(`/organizations/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>New organization</h1>
        <button className="btn secondary" onClick={() => navigate('/organizations')}>
          Cancel
        </button>
      </div>

      {/* Non-field errors (quota, network, generic) show as a banner;
          field-specific issues render inline below their input. */}
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              className={fieldErrors.name ? 'invalid' : ''}
              aria-invalid={!!fieldErrors.name}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="code">Code *</label>
            <input
              id="code"
              className={fieldErrors.code ? 'invalid' : ''}
              aria-invalid={!!fieldErrors.code}
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="ACME-IN"
              required
            />
            {fieldErrors.code ? (
              <div className="field-error">{fieldErrors.code}</div>
            ) : (
              <div className="hint">Unique; members use it to sign in to this organization.</div>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            className={fieldErrors.email ? 'invalid' : ''}
            aria-invalid={!!fieldErrors.email}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
          {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="base_currency">Base currency</label>
            <input
              id="base_currency"
              value={form.base_currency}
              onChange={(e) => set('base_currency', e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label htmlFor="fiscal_year_start">Fiscal year start (MM-DD)</label>
            <input
              id="fiscal_year_start"
              value={form.fiscal_year_start}
              onChange={(e) => set('fiscal_year_start', e.target.value)}
              placeholder="04-01"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="timezone">Timezone</label>
          <input id="timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 16px' }} />
        <p className="muted" style={{ marginTop: 0 }}>
          Optional — invite the organization's first administrator. They accept the invitation, then
          use Organization sign-in with this organization's code.
        </p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="admin_email">Admin email</label>
            <input
              id="admin_email"
              type="email"
              className={fieldErrors.admin_email ? 'invalid' : ''}
              aria-invalid={!!fieldErrors.admin_email}
              value={form.admin_email}
              onChange={(e) => set('admin_email', e.target.value)}
            />
            {fieldErrors.admin_email && <div className="field-error">{fieldErrors.admin_email}</div>}
          </div>
          <div className="field">
            <label htmlFor="admin_name">Admin name</label>
            <input id="admin_name" value={form.admin_name} onChange={(e) => set('admin_name', e.target.value)} />
          </div>
        </div>

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create organization'}
          </button>
        </div>
      </form>
    </div>
  )
}
