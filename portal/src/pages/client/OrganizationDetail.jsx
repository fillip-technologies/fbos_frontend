import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { organizationsApi } from '../../api/client.js'
import { getFieldErrors } from '../../api/errors.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'

const STATUS_OPTIONS = ['active', 'suspended', 'archived']

// Only these fields are editable per OrganizationUpdateRequest in the Identity service.
function toForm(org) {
  return {
    name: org.name || '',
    email: org.email || '',
    base_currency: org.base_currency || '',
    fiscal_year_start: org.fiscal_year_start || '',
    timezone: org.timezone || '',
    status: org.status || 'active',
  }
}

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fieldErrors = getFieldErrors(error)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    organizationsApi
      .get(id)
      .then((o) => {
        if (cancelled) return
        setOrg(o)
        setForm(toForm(o))
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // Send only fields that actually changed.
      const original = toForm(org)
      const body = {}
      for (const [field, value] of Object.entries(form)) {
        const next = typeof value === 'string' ? value.trim() : value
        if (next !== original[field]) body[field] = next
      }

      if (Object.keys(body).length === 0) {
        setSaved(true)
        return
      }
      const updated = await organizationsApi.update(id, body)
      setOrg(updated)
      setForm(toForm(updated))
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  // Keep an unexpected current status selectable instead of silently showing another.
  const statusOptions =
    form && !STATUS_OPTIONS.includes(form.status) ? [form.status, ...STATUS_OPTIONS] : STATUS_OPTIONS
  if (error && !org)
    return (
      <div>
        <ErrorBanner error={error} onRetry={() => navigate(0)} />
        <button className="btn secondary" onClick={() => navigate('/organizations')}>
          ← Back to organizations
        </button>
      </div>
    )

  return (
    <div>
      <div className="page-head">
        <h1>
          {org.name} <StatusBadge status={org.status} />
        </h1>
        <button className="btn secondary" onClick={() => navigate('/organizations')}>
          ← Back
        </button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {saved && <div className="alert success">Saved.</div>}

      <form className="panel" onSubmit={handleSave}>
        <div className="grid-2">
          <div className="field">
            <label>Code (read-only)</label>
            <input value={org.code || ''} disabled className="mono" />
          </div>
          <div className="field">
            <label>ID (read-only)</label>
            <input value={org.id} disabled className="mono" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="name">Name</label>
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
              required
            />
          </div>
          <div className="field">
            <label htmlFor="fiscal_year_start">Fiscal year start (MM-DD)</label>
            <input
              id="fiscal_year_start"
              value={form.fiscal_year_start}
              onChange={(e) => set('fiscal_year_start', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {org.created_at && <p className="muted">Created: {org.created_at}</p>}

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
