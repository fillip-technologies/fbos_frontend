import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leadsApi } from '@/features/sales/api.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import useVerticals from '@/features/sales/useVerticals.js'
import { CONSENT_CHANNELS, DEFAULT_CONSENT_TEXT, LEAD_SOURCES } from '@/features/sales/utils.js'

export default function LeadCreate() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { owners } = useOwners(orgId)
  const { verticals } = useVerticals(orgId)
  const [form, setForm] = useState({
    vertical_id: '',
    source: 'website',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    company_name: '',
    campaign_ref: '',
    owner_user_id: me?.id || '',
    consent_given: false,
    consent_text: DEFAULT_CONSENT_TEXT,
    consent_channel: 'website_form',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const ownerChoices = owners || [me].filter(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        vertical_id: form.vertical_id,
        source: form.source,
        contact_name: form.contact_name.trim(),
        consent: { given: form.consent_given, text: form.consent_text.trim(), channel: form.consent_channel },
      }
      for (const k of ['contact_email', 'contact_phone', 'company_name', 'campaign_ref']) {
        if (form[k].trim()) body[k] = form[k].trim()
      }
      if (form.owner_user_id) body.owner_user_id = form.owner_user_id
      const created = await leadsApi.create(orgId, body)
      navigate(`/leads/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New lead</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate('/leads')}>Cancel</button>
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="contact_name">Contact name *</label>
            <input
              id="contact_name"
              required
              maxLength={255}
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
            />
            {fieldErrors.contact_name && <div className="field-error">{fieldErrors.contact_name}</div>}
          </div>
          <div className="field">
            <label htmlFor="company_name">Company</label>
            <input id="company_name" maxLength={255} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="contact_email">Email</label>
            <input
              id="contact_email"
              type="email"
              maxLength={255}
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="contact_phone">Phone</label>
            <input id="contact_phone" maxLength={50} value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
          </div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="vertical_id">Vertical *</label>
            <select id="vertical_id" required value={form.vertical_id} onChange={(e) => set('vertical_id', e.target.value)}>
              <option value="">— Choose —</option>
              {verticals.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            {verticals.length === 0 && <div className="hint">No verticals yet. Add them on the Vertical packs page.</div>}
          </div>
          <div className="field">
            <label htmlFor="source">Source</label>
            <select id="source" value={form.source} onChange={(e) => set('source', e.target.value)}>
              {Object.entries(LEAD_SOURCES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="owner_user_id">Owner</label>
            <select id="owner_user_id" value={form.owner_user_id} onChange={(e) => set('owner_user_id', e.target.value)}>
              <option value="">— Unassigned —</option>
              {ownerChoices.map((u) => (
                <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
              ))}
            </select>
          </div>
        </div>
        {form.source === 'campaign' && (
          <div className="field">
            <label htmlFor="campaign_ref">Campaign</label>
            <input id="campaign_ref" value={form.campaign_ref} onChange={(e) => set('campaign_ref', e.target.value)} />
          </div>
        )}

        <h3 style={{ margin: '8px 0 6px', fontSize: 15 }}>Consent</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Personal data is kept only with the person's consent (DPDP Act). Record what they agreed to and how.
        </p>
        <label className="inline-check">
          <input type="checkbox" checked={form.consent_given} onChange={(e) => set('consent_given', e.target.checked)} />
          They agreed to be contacted
        </label>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="consent_text">Consent text shown *</label>
            <input id="consent_text" required value={form.consent_text} onChange={(e) => set('consent_text', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="consent_channel">Captured via</label>
            <select id="consent_channel" value={form.consent_channel} onChange={(e) => set('consent_channel', e.target.value)}>
              {Object.entries(CONSENT_CHANNELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={submitting || !orgId}>{submitting ? 'Creating…' : 'Create lead'}</button>
        </div>
      </form>
    </div>
  )
}
