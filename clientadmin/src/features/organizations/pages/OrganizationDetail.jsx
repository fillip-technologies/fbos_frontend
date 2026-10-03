import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { calendarsApi } from '@/features/calendars/api.js'
import { organizationsApi } from '@/features/organizations/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import OrganizationFields from '@/features/organizations/components/OrganizationForm.jsx'

const STATUS_OPTIONS = ['active', 'suspended', 'archived']
const toForm = (o) => ({
  name: o.name || '',
  code: o.code || '',
  email: o.email || '',
  base_currency: o.base_currency || '',
  timezone: o.timezone || '',
  fiscal_year_start: o.fiscal_year_start || '',
  status: o.status || 'active',
  calendar_id: o.calendar_id || '',
})

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { selectOrg, reload: reloadOrgs } = useActiveOrg()
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState(null)
  const [calendars, setCalendars] = useState(null) // null until loaded, or when they can't be read
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
    calendarsApi
      .list(id)
      .then((c) => !cancelled && setCalendars(c))
      .catch(() => !cancelled && setCalendars(null))
    return () => {
      cancelled = true
    }
  }, [id])

  // Calendars are created on the Working calendars page, which works in the selected organization.
  function openCalendars() {
    selectOrg(id)
    navigate('/calendars')
  }

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
      if (form.calendar_id && form.calendar_id !== (org.calendar_id || '')) body.calendar_id = form.calendar_id
      if (Object.keys(body).length) {
        const updated = await organizationsApi.update(id, body)
        setOrg(updated)
        setForm(toForm(updated))
        reloadOrgs() // the org switcher and calendar pages read these too
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
        {calendars && (
          <div className="field">
            <label htmlFor="org-calendar">Company calendar</label>
            <select id="org-calendar" value={form.calendar_id} onChange={(e) => set('calendar_id', e.target.value)}>
              {/* Like a unit's calendar, it can be replaced but not removed. */}
              {!org.calendar_id && <option value="">— None yet —</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.timezone})</option>
              ))}
            </select>
            {calendars.length === 0 ? (
              <div className="hint">
                This company has no calendars yet.{' '}
                <button type="button" className="link-btn" onClick={openCalendars}>Create one</button>.
              </div>
            ) : (
              <div className="hint">
                The company's working hours and holidays. New branches start on it; branches, departments and teams on the
                previous one (or on none) switch to it, and those with a calendar of their own keep theirs.
              </div>
            )}
            {fieldErrors.calendar_id && <div className="field-error">{fieldErrors.calendar_id}</div>}
          </div>
        )}
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
