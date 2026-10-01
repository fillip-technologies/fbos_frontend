import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { organizationsApi } from '../api/client.js'
import { getFieldErrors } from '../api/errors.js'
import ErrorBanner from '../components/ErrorBanner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import OrganizationFields from './OrganizationForm.jsx'

const STATUS_OPTIONS = ['active', 'suspended', 'archived']
const toForm = (o) => ({
  name: o.name || '',
  code: o.code || '',
  email: o.email || '',
  base_currency: o.base_currency || '',
  timezone: o.timezone || '',
  fiscal_year_start: o.fiscal_year_start || '',
  status: o.status || 'active',
})

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  useEffect(() => {
    let cancelled = false
    organizationsApi
      .get(id)
      .then((o) => {
        if (cancelled) return
        setOrg(o)
        setForm(toForm(o))
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // Send only what changed.
      const body = {}
      for (const k of ['name', 'email', 'base_currency', 'timezone', 'fiscal_year_start', 'status']) {
        if (form[k].trim() !== (org[k] || '')) body[k] = form[k].trim()
      }
      if (Object.keys(body).length) {
        const updated = await organizationsApi.update(id, body)
        setOrg(updated)
        setForm(toForm(updated))
      }
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (!org)
    return (
      <div>
        <ErrorBanner error={error} onRetry={() => navigate(0)} />
        <button className="btn secondary" onClick={() => navigate('/organizations')}>← Back</button>
      </div>
    )

  return (
    <div>
      <div className="page-head">
        <h1>
          {org.name} <StatusBadge status={org.status} />
        </h1>
        <button className="btn secondary" onClick={() => navigate('/organizations')}>← Back</button>
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {saved && <div className="alert success">Saved.</div>}
      <form className="panel" onSubmit={handleSave}>
        <OrganizationFields form={form} set={set} fieldErrors={fieldErrors} isCreate={false} />
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
