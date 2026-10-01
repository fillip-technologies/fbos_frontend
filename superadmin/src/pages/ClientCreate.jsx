import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi } from '../api/client.js'
import { friendlyMessage, getFieldErrors } from '../api/errors.js'
import ErrorBanner from '../components/ErrorBanner.jsx'

// Mirrors ClientCreateRequest in the Identity service. When admin_email is given
// the backend invites the first client_admin into the auto-created organization.
const INITIAL = {
  name: '',
  code: '',
  contact_email: '',
  admin_email: '',
  admin_name: '',
  base_currency: 'INR',
  fiscal_year_start: '04-01',
  timezone: 'Asia/Kolkata',
  // Quotas controlled exclusively by platform_admin (bounds mirror the backend).
  max_organizations: 2,
  max_users_per_org: 50,
}

export default function ClientCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Field-level errors: validation (422) issues plus a manual mapping for the
  // code-conflict domain error, which has no field attached on the backend.
  const fieldErrors = { ...getFieldErrors(error) }
  if (error && (error.code === 'CLIENT_CODE_EXISTS' || error.code === 'DUPLICATE_CODE')) {
    fieldErrors.code = friendlyMessage(error)
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Drop empty optionals so the backend applies its own defaults.
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        base_currency: form.base_currency.trim() || 'INR',
        fiscal_year_start: form.fiscal_year_start.trim() || '04-01',
        timezone: form.timezone.trim() || 'Asia/Kolkata',
        max_organizations: Number(form.max_organizations),
        max_users_per_org: Number(form.max_users_per_org),
        contact_email: form.contact_email.trim(),
      }
      if (form.admin_email.trim()) body.admin_email = form.admin_email.trim()
      if (form.admin_name.trim()) body.admin_name = form.admin_name.trim()

      const created = await clientsApi.create(body)
      navigate(`/clients/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>New client</h1>
        <button className="btn secondary" onClick={() => navigate('/clients')}>
          Cancel
        </button>
      </div>

      {/* Non-field errors (network, rate limit, generic) show as a banner;
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
              placeholder="ACME"
              required
            />
            {fieldErrors.code ? (
              <div className="field-error">{fieldErrors.code}</div>
            ) : (
              <div className="hint">Unique slug used to identify the client.</div>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="contact_email">Contact email *</label>
          <input
            id="contact_email"
            type="email"
            className={fieldErrors.contact_email ? 'invalid' : ''}
            aria-invalid={!!fieldErrors.contact_email}
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
            required
          />
          {fieldErrors.contact_email ? (
            <div className="field-error">{fieldErrors.contact_email}</div>
          ) : (
            <div className="hint">Also used as the email of the client's first organization.</div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 16px' }} />
        <p className="muted" style={{ marginTop: 0 }}>
          Optional — invite the first client administrator into the auto-created organization.
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
          Quotas — platform-admin controlled. The client admin cannot change these.
        </p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="max_organizations">Max organizations</label>
            <input
              id="max_organizations"
              type="number"
              min={1}
              max={1000}
              className={fieldErrors.max_organizations ? 'invalid' : ''}
              aria-invalid={!!fieldErrors.max_organizations}
              value={form.max_organizations}
              onChange={(e) => set('max_organizations', e.target.value)}
            />
            {fieldErrors.max_organizations ? (
              <div className="field-error">{fieldErrors.max_organizations}</div>
            ) : (
              <div className="hint">Between 1 and 1000.</div>
            )}
          </div>
          <div className="field">
            <label htmlFor="max_users_per_org">Max users per organization</label>
            <input
              id="max_users_per_org"
              type="number"
              min={1}
              max={10000}
              className={fieldErrors.max_users_per_org ? 'invalid' : ''}
              aria-invalid={!!fieldErrors.max_users_per_org}
              value={form.max_users_per_org}
              onChange={(e) => set('max_users_per_org', e.target.value)}
            />
            {fieldErrors.max_users_per_org ? (
              <div className="field-error">{fieldErrors.max_users_per_org}</div>
            ) : (
              <div className="hint">Between 1 and 10000.</div>
            )}
          </div>
        </div>

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>
    </div>
  )
}
