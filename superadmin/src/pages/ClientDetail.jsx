import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clientsApi } from '../api/client.js'
import { friendlyMessage, getFieldErrors } from '../api/errors.js'
import StatusBadge from '../components/StatusBadge.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import { addOneYear, todayIso } from '../utils/dates.js'

// Only these fields are editable per ClientUpdateRequest in the Identity service.
const STATUS_OPTIONS = ['active', 'suspended', 'archived']

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    status: '',
    max_organizations: '',
    max_users_per_org: '',
    subscription_start: '',
    subscription_end: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fieldErrors = { ...getFieldErrors(error) }
  if (error && error.code === 'INVALID_SUBSCRIPTION_WINDOW') {
    fieldErrors.subscription_end = friendlyMessage(error)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    clientsApi
      .get(id)
      .then((c) => {
        if (cancelled) return
        setClient(c)
        setForm({
          name: c.name || '',
          contact_email: c.contact_email || '',
          status: c.status || 'active',
          max_organizations: c.max_organizations ?? '',
          max_users_per_org: c.max_users_per_org ?? '',
          subscription_start: c.subscription_start || '',
          subscription_end: c.subscription_end || '',
        })
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
      const body = {}
      if (form.name.trim() !== (client.name || '')) body.name = form.name.trim()
      if (form.contact_email.trim() !== (client.contact_email || ''))
        body.contact_email = form.contact_email.trim()
      if (form.status !== client.status) body.status = form.status
      if (Number(form.max_organizations) !== client.max_organizations)
        body.max_organizations = Number(form.max_organizations)
      if (Number(form.max_users_per_org) !== client.max_users_per_org)
        body.max_users_per_org = Number(form.max_users_per_org)
      if (form.subscription_start && form.subscription_start !== client.subscription_start)
        body.subscription_start = form.subscription_start
      if (form.subscription_end && form.subscription_end !== client.subscription_end)
        body.subscription_end = form.subscription_end

      if (Object.keys(body).length === 0) {
        setSaved(true)
        return
      }
      const updated = await clientsApi.update(id, body)
      setClient(updated)
      setForm({
        name: updated.name || '',
        contact_email: updated.contact_email || '',
        status: updated.status || 'active',
        max_organizations: updated.max_organizations ?? '',
        max_users_per_org: updated.max_users_per_org ?? '',
        subscription_start: updated.subscription_start || '',
        subscription_end: updated.subscription_end || '',
      })
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    try {
      await clientsApi.remove(id)
      navigate('/clients', { replace: true })
    } catch (err) {
      setError(err)
      setDeleting(false)
    }
  }

  // Renew: one year after the later of the current end date and today.
  function renewOneYear() {
    const base = form.subscription_end && form.subscription_end > todayIso() ? form.subscription_end : todayIso()
    set('subscription_end', addOneYear(base))
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (error && !client)
    return (
      <div>
        <ErrorBanner error={error} onRetry={() => navigate(0)} />
        <button className="btn secondary" onClick={() => navigate('/clients')}>
          ← Back to clients
        </button>
      </div>
    )

  return (
    <div>
      <div className="page-head">
        <h1>
          {client.name} <StatusBadge status={client.status} />{' '}
          <StatusBadge status={client.subscription_state} />
        </h1>
        <button className="btn secondary" onClick={() => navigate('/clients')}>
          ← Back
        </button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {saved && <div className="alert success">Saved.</div>}

      <form className="panel" onSubmit={handleSave}>
        <div className="grid-2">
          <div className="field">
            <label>Code (read-only)</label>
            <input value={client.code} disabled className="mono" />
          </div>
          <div className="field">
            <label>ID (read-only)</label>
            <input value={client.id} disabled className="mono" />
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
          {fieldErrors.contact_email && <div className="field-error">{fieldErrors.contact_email}</div>}
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 16px' }} />
        <p className="muted" style={{ marginTop: 0 }}>
          Subscription — platform-admin controlled. Client users are locked out outside this period
          {client.subscription_state === 'expired' && ' (currently expired)'}.
        </p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="subscription_start">Service start</label>
            <input
              id="subscription_start"
              type="date"
              className={fieldErrors.subscription_start ? 'invalid' : ''}
              value={form.subscription_start}
              onChange={(e) => set('subscription_start', e.target.value)}
            />
            {fieldErrors.subscription_start && <div className="field-error">{fieldErrors.subscription_start}</div>}
          </div>
          <div className="field">
            <label htmlFor="subscription_end">Service end</label>
            <input
              id="subscription_end"
              type="date"
              min={form.subscription_start}
              className={fieldErrors.subscription_end ? 'invalid' : ''}
              value={form.subscription_end}
              onChange={(e) => set('subscription_end', e.target.value)}
            />
            {fieldErrors.subscription_end && <div className="field-error">{fieldErrors.subscription_end}</div>}
            <div className="hint">
              <button type="button" className="btn secondary" onClick={renewOneYear}>
                Renew +1 year
              </button>
            </div>
          </div>
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
            ) : typeof client.active_organizations_count === 'number' ? (
              <div className="hint">
                {client.active_organizations_count} of {form.max_organizations || client.max_organizations} in use.
              </div>
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

        {client.created_at && (
          <p className="muted">Created: {client.created_at}</p>
        )}

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="panel" style={{ marginTop: 24, borderColor: '#fecaca' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 6px', color: 'var(--danger)' }}>Delete client</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Permanently deletes this client with all of its organizations, users and sign-in credentials.
          This cannot be undone. To only block access, set the status to suspended instead.
        </p>
        {!confirmDelete ? (
          <button type="button" className="btn secondary" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
            Delete client…
          </button>
        ) : (
          <div>
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="confirm_code">
                Type <span className="mono">{client.code}</span> to confirm
              </label>
              <input id="confirm_code" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} autoFocus />
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)' }}
                disabled={deleting || confirmCode !== client.code}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false)
                  setConfirmCode('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
