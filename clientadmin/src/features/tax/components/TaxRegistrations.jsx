import { useState } from 'react'
import { taxRegistrationsApi } from '@/features/tax/api.js'
import { useTaxEntries } from '@/features/tax/useTaxConfig.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

const EMPTY = { regime_code: '', registration_no: '', legal_name: '', trade_name: '', lut_number: '', lut_valid_from: '', lut_valid_to: '', is_default: false }
const blankToNull = (value) => (value === '' ? null : value)

function RegistrationForm({ orgId, regimes, isFirst, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, regime_code: regimes[0]?.code || '', is_default: isFirst })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await taxRegistrationsApi.create(orgId, {
        regime_code: form.regime_code,
        registration_no: form.registration_no.trim(),
        legal_name: form.legal_name.trim(),
        trade_name: blankToNull(form.trade_name.trim()),
        lut_number: blankToNull(form.lut_number.trim()),
        lut_valid_from: blankToNull(form.lut_valid_from),
        lut_valid_to: blankToNull(form.lut_valid_to),
        is_default: form.is_default,
      })
      onSaved()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 14 }}>
      <h3>Add a registration</h3>
      <ErrorBanner error={error} />
      <div className="grid-3">
        <div className="field">
          <label htmlFor="reg-regime">Tax system *</label>
          <select id="reg-regime" required value={form.regime_code} onChange={(e) => set('regime_code', e.target.value)}>
            {regimes.map((regime) => (
              <option key={regime.code} value={regime.code}>{regime.data.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reg-no">Registration number (GSTIN) *</label>
          <input id="reg-no" required className="mono-input" maxLength={50} value={form.registration_no} onChange={(e) => set('registration_no', e.target.value.toUpperCase())} />
          <div className="hint">Checked for its format and check character. Its state is read from it.</div>
          {fieldErrors.registration_no && <div className="field-error">{fieldErrors.registration_no}</div>}
        </div>
        <div className="field">
          <label htmlFor="reg-legal">Legal name *</label>
          <input id="reg-legal" required maxLength={512} value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
        </div>
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="reg-trade">Trade name</label>
          <input id="reg-trade" maxLength={512} value={form.trade_name} onChange={(e) => set('trade_name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reg-lut">LUT number</label>
          <input id="reg-lut" className="mono-input" maxLength={100} value={form.lut_number} onChange={(e) => set('lut_number', e.target.value)} />
          <div className="hint">Letter of undertaking: exports and SEZ supplies go out without IGST while it is valid.</div>
        </div>
        <div className="field">
          <label htmlFor="reg-lut-from">LUT valid</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="reg-lut-from" type="date" aria-label="LUT valid from" value={form.lut_valid_from} onChange={(e) => set('lut_valid_from', e.target.value)} />
            <input type="date" aria-label="LUT valid to" value={form.lut_valid_to} onChange={(e) => set('lut_valid_to', e.target.value)} />
          </div>
        </div>
      </div>
      <label className="inline-check">
        <input type="checkbox" checked={form.is_default} onChange={(e) => set('is_default', e.target.checked)} />
        Use for documents that don’t choose a registration
      </label>
      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Adding…' : 'Add registration'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

function LutEditor({ orgId, registration, onSaved, onCancel }) {
  const [form, setForm] = useState({
    lut_number: registration.lut_number || '',
    lut_valid_from: registration.lut_valid_from || '',
    lut_valid_to: registration.lut_valid_to || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await taxRegistrationsApi.update(orgId, registration, {
        lut_number: blankToNull(form.lut_number.trim()),
        lut_valid_from: blankToNull(form.lut_valid_from),
        lut_valid_to: blankToNull(form.lut_valid_to),
      })
      onSaved()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="row-actions" style={{ alignItems: 'end', flexWrap: 'wrap' }}>
      <ErrorBanner error={error} />
      <input aria-label="LUT number" className="mono-input" placeholder="LUT number" value={form.lut_number} onChange={(e) => setForm({ ...form, lut_number: e.target.value })} style={{ maxWidth: 180 }} />
      <input type="date" aria-label="LUT valid from" value={form.lut_valid_from} onChange={(e) => setForm({ ...form, lut_valid_from: e.target.value })} style={{ maxWidth: 160 }} />
      <input type="date" aria-label="LUT valid to" value={form.lut_valid_to} onChange={(e) => setForm({ ...form, lut_valid_to: e.target.value })} style={{ maxWidth: 160 }} />
      <button className="btn small-btn" type="submit" disabled={saving}>Save</button>
      <button type="button" className="btn secondary small-btn" onClick={onCancel} disabled={saving}>Cancel</button>
    </form>
  )
}

// The organization's own registrations: who the supplier is on its documents. Billing needs
// at least one; with several, the default is used unless a document chooses another.
export default function TaxRegistrations({ orgId, canManage }) {
  const { data, error, loading, reload } = useQuery(['tax-registrations', orgId], ({ signal }) => taxRegistrationsApi.list(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const { entries: regimeEntries } = useTaxEntries(orgId, 'regime')
  const regimes = regimeEntries.filter((entry) => entry.data.kind === 'indirect')
  const registrations = data ?? []
  const [adding, setAdding] = useState(false)
  const [editingLut, setEditingLut] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  async function update(registration, body) {
    setBusy(true)
    setActionError(null)
    try {
      await taxRegistrationsApi.update(orgId, registration, body)
      reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PanelSkeleton />
  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: 17 }}>Your registrations</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            One per state you are registered in. Invoices are numbered per registration, and their GST depends on which state the
            supply is made from.
          </p>
        </div>
        {canManage && !adding && regimes.length > 0 && <button className="btn" onClick={() => setAdding(true)}>+ Add registration</button>}
      </div>
      <ErrorBanner error={error || actionError} onRetry={error ? reload : undefined} />
      {registrations.length === 0 && !adding && (
        <div className="alert warn">No registration yet. Invoices and quotations can’t be taxed until you add your GSTIN.</div>
      )}
      {adding && (
        <RegistrationForm
          orgId={orgId}
          regimes={regimes}
          isFirst={registrations.length === 0}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {registrations.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>State</th>
              <th>LUT</th>
              <th>Status</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration.id} style={{ cursor: 'default' }}>
                <td>
                  <div className="mono">{registration.registration_no}</div>
                  <div className="muted small">
                    {registration.legal_name}
                    {registration.is_default && <span className="chip subtle" style={{ marginLeft: 6 }}>Default</span>}
                  </div>
                </td>
                <td className="mono">{registration.jurisdiction_code || '—'}</td>
                <td className="small">
                  {editingLut === registration.id ? (
                    <LutEditor
                      orgId={orgId}
                      registration={registration}
                      onSaved={() => {
                        setEditingLut(null)
                        reload()
                      }}
                      onCancel={() => setEditingLut(null)}
                    />
                  ) : registration.lut_number ? (
                    <>
                      <span className="mono">{registration.lut_number}</span>
                      <div className="muted">
                        {formatDate(registration.lut_valid_from)} – {formatDate(registration.lut_valid_to)}
                      </div>
                    </>
                  ) : (
                    <span className="muted">None</span>
                  )}
                </td>
                <td><StatusBadge status={registration.status} /></td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      {editingLut !== registration.id && (
                        <button className="btn secondary small-btn" disabled={busy} onClick={() => setEditingLut(registration.id)}>LUT…</button>
                      )}
                      {!registration.is_default && registration.status === 'active' && (
                        <button className="btn secondary small-btn" disabled={busy} onClick={() => update(registration, { is_default: true })}>
                          Make default
                        </button>
                      )}
                      <button
                        className="btn secondary small-btn"
                        disabled={busy}
                        onClick={() => update(registration, { status: registration.status === 'active' ? 'inactive' : 'active' })}
                      >
                        {registration.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
