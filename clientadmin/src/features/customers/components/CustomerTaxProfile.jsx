import { useState } from 'react'
import { customersApi } from '@/features/customers/api.js'
import { useTaxEntries } from '@/features/tax/useTaxConfig.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const toForm = (profile) => ({
  registration_type: profile.registration_type || '',
  registration_no: profile.registration_no || '',
  place_of_supply: profile.place_of_supply || '',
  country: profile.country || '',
  tds_section_code: profile.tds_section_code || '',
  certificates: (profile.lower_deduction_certificates || []).map((c) => ({ ...c, percent: String(c.percent) })),
})
const blankToNull = (value) => (value.trim() === '' ? null : value.trim())

function Effective({ label, value }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value || <span className="muted">—</span>}</div>
    </div>
  )
}

// How tax applies to a customer. Everything is optional: blanks fall back to the customer's
// GSTIN and billing address. Set the TDS section when this customer deducts tax from what it
// pays (most companies do for services).
export default function CustomerTaxProfile({ orgId, customerId, canManage }) {
  const { data: profile, error: loadError, loading, reload, setData } = useQuery(
    ['customer-tax-profile', orgId, customerId],
    ({ signal }) => customersApi.taxProfile(orgId, customerId, { signal }),
    { enabled: Boolean(orgId) }
  )
  const { entries: regimes } = useTaxEntries(orgId, 'regime')
  const { entries: sections } = useTaxEntries(orgId, 'withholding_section')
  const { entries: jurisdictions } = useTaxEntries(orgId, 'jurisdiction')
  const registrationTypes = [...new Set(regimes.flatMap((regime) => regime.data.party_registration_types || []))]
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  if (loading) return <PanelSkeleton />
  if (!profile) return <ErrorBanner error={loadError} onRetry={reload} />
  const current = form ?? toForm(profile)
  const set = (k, v) => {
    setSaved(false)
    setForm({ ...current, [k]: v })
  }
  const setCertificate = (index, k, v) => set('certificates', current.certificates.map((c, i) => (i === index ? { ...c, [k]: v } : c)))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        registration_type: blankToNull(current.registration_type),
        registration_no: blankToNull(current.registration_no),
        place_of_supply: blankToNull(current.place_of_supply),
        country: blankToNull(current.country),
        tds_section_code: blankToNull(current.tds_section_code),
        lower_deduction_certificates: current.certificates.map((c) => ({ ...c, percent: Number(c.percent) })),
      }
      setData(await customersApi.saveTaxProfile(orgId, customerId, profile.version, body))
      setForm(null)
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const effective = profile.effective || {}
  const disabled = !canManage || saving
  return (
    <>
      <div className="panel">
        <h2 style={{ fontSize: 17, marginTop: 0 }}>What billing uses</h2>
        {Object.keys(effective).length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Add your company’s GST registration under Tax setup to see this.</p>
        ) : (
          <div className="details-grid">
            <Effective label="Customer type" value={effective.registration_type} />
            <Effective label="GSTIN" value={effective.registration_no && <span className="mono">{effective.registration_no}</span>} />
            <Effective label="Place of supply" value={effective.place_of_supply} />
            <Effective label="Country" value={effective.country} />
            <Effective label="Deducts TDS under" value={effective.tds_section_code} />
          </div>
        )}
      </div>

      <form className="panel" onSubmit={submit}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Tax profile</h2>
        <ErrorBanner error={error} />
        {saved && <div className="alert success">Saved.</div>}
        <div className="grid-3">
          <div className="field">
            <label htmlFor="ctp-type">Customer type</label>
            <select id="ctp-type" disabled={disabled} value={current.registration_type} onChange={(e) => set('registration_type', e.target.value)}>
              <option value="">From the GSTIN and address</option>
              {registrationTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="hint">SEZ units and overseas customers are taxed differently (zero-rated under a LUT).</div>
          </div>
          <div className="field">
            <label htmlFor="ctp-place">Place of supply</label>
            <select id="ctp-place" disabled={disabled} value={current.place_of_supply} onChange={(e) => set('place_of_supply', e.target.value)}>
              <option value="">From the billing address</option>
              {jurisdictions.map((j) => <option key={j.code} value={j.code}>{j.code} · {j.data.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ctp-country">Country</label>
            <input id="ctp-country" className="mono-input" maxLength={2} placeholder="From the address" disabled={disabled} value={current.country} onChange={(e) => set('country', e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ctp-gstin">Registration number</label>
            <input id="ctp-gstin" className="mono-input" maxLength={50} placeholder="The customer’s GSTIN" disabled={disabled} value={current.registration_no} onChange={(e) => set('registration_no', e.target.value.toUpperCase())} />
          </div>
          <div className="field">
            <label htmlFor="ctp-tds">Deducts TDS under</label>
            <select id="ctp-tds" disabled={disabled} value={current.tds_section_code} onChange={(e) => set('tds_section_code', e.target.value)}>
              <option value="">Doesn’t deduct TDS</option>
              {sections.map((section) => (
                <option key={section.code} value={section.code}>{section.data.nature} ({section.data.statute_ref})</option>
              ))}
            </select>
            <div className="hint">Invoices then show the TDS they may withhold, and what to expect in cash.</div>
          </div>
        </div>

        <h3 style={{ fontSize: 15, margin: '6px 0' }}>Lower deduction certificates</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Your certificates that let this customer deduct TDS at a lower rate, for a period.</p>
        {current.certificates.map((certificate, index) => (
          <div key={index} className="row-actions" style={{ alignItems: 'end', marginBottom: 8, flexWrap: 'wrap' }}>
            <input aria-label="Certificate number" required placeholder="Certificate no." disabled={disabled} value={certificate.certificate_no} onChange={(e) => setCertificate(index, 'certificate_no', e.target.value)} style={{ maxWidth: 200 }} />
            <input aria-label="Rate %" type="number" required min="0" max="100" step="any" placeholder="Rate %" disabled={disabled} value={certificate.percent} onChange={(e) => setCertificate(index, 'percent', e.target.value)} style={{ maxWidth: 110 }} />
            <input aria-label="Valid from" type="date" required disabled={disabled} value={certificate.valid_from} onChange={(e) => setCertificate(index, 'valid_from', e.target.value)} style={{ maxWidth: 160 }} />
            <input aria-label="Valid to" type="date" required disabled={disabled} value={certificate.valid_to} onChange={(e) => setCertificate(index, 'valid_to', e.target.value)} style={{ maxWidth: 160 }} />
            {canManage && (
              <button type="button" className="btn secondary small-btn" onClick={() => set('certificates', current.certificates.filter((_, i) => i !== index))}>Remove</button>
            )}
          </div>
        ))}
        {canManage && (
          <button
            type="button"
            className="btn secondary small-btn"
            onClick={() => set('certificates', [...current.certificates, { certificate_no: '', percent: '', valid_from: '', valid_to: '' }])}
          >
            + Add certificate
          </button>
        )}
        {canManage && (
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={saving || !form} aria-busy={saving}>{saving ? 'Saving…' : 'Save tax profile'}</button>
          </div>
        )}
      </form>
    </>
  )
}
