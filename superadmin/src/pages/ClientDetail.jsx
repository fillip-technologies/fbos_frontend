import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clientsApi } from '../api/client.js'
import { friendlyMessage, getFieldErrors } from '../api/errors.js'
import StatusBadge from '../components/StatusBadge.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'

// Only these fields are editable per ClientUpdateRequest in the Identity service.
const STATUS_OPTIONS = ['active', 'suspended', 'archived']

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({ name: '', contact_email: '', status: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fieldErrors = getFieldErrors(error)

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
        body.contact_email = form.contact_email.trim() || null
      if (form.status !== client.status) body.status = form.status

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
      })
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
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
          {client.name} <StatusBadge status={client.status} />
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
          <label htmlFor="contact_email">Contact email</label>
          <input
            id="contact_email"
            type="email"
            className={fieldErrors.contact_email ? 'invalid' : ''}
            aria-invalid={!!fieldErrors.contact_email}
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
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

        {client.created_at && (
          <p className="muted">Created: {client.created_at}</p>
        )}

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
