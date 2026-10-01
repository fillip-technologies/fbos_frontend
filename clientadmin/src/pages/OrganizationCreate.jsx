import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { organizationsApi } from '../api/client.js'
import { friendlyMessage, getFieldErrors } from '../api/errors.js'
import ErrorBanner from '../components/ErrorBanner.jsx'
import { DEFAULT_FISCAL_YEAR_START } from '../utils/format.js'
import OrganizationFields from './OrganizationForm.jsx'

export default function OrganizationCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    code: '',
    email: '',
    base_currency: 'INR',
    timezone: 'Asia/Kolkata',
    fiscal_year_start: DEFAULT_FISCAL_YEAR_START,
    admin_email: '',
    admin_name: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fieldErrors = { ...getFieldErrors(error) }
  if (error && (error.code === 'ORGANIZATION_CODE_EXISTS' || error.code === 'DUPLICATE_CODE')) {
    fieldErrors.code = friendlyMessage(error)
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        email: form.email.trim(),
        base_currency: form.base_currency.trim(),
        timezone: form.timezone.trim(),
        fiscal_year_start: form.fiscal_year_start.trim(),
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
        <button className="btn secondary" onClick={() => navigate('/organizations')}>Cancel</button>
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <form className="panel" onSubmit={handleSubmit}>
        <OrganizationFields form={form} set={set} fieldErrors={fieldErrors} isCreate />

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 16px' }} />
        <p className="muted" style={{ marginTop: 0 }}>
          Optional — invite the first administrator of this organization. They'll get an email to set a password.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="admin_email">Admin email</label>
            <input
              id="admin_email"
              type="email"
              className={fieldErrors.admin_email ? 'invalid' : ''}
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
