import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assetMasterApi, assetsApi } from '@/features/assets/api.js'
import { CRITICALITY_LABELS } from '@/features/assets/utils.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

export default function AssetCreate() {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()

  const [name, setName] = useState('')
  const [typeCode, setTypeCode] = useState('')
  const [ownerUnitId, setOwnerUnitId] = useState('')
  const [criticality, setCriticality] = useState('medium')
  const [serialNo, setSerialNo] = useState('')
  const [locationDetails, setLocationDetails] = useState('')
  const [vendorAccountId, setVendorAccountId] = useState('')
  const [acquiredOn, setAcquiredOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [costAmount, setCostAmount] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [autoRenew, setAutoRenew] = useState(false)
  const [attributes, setAttributes] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const types = useLookup(
    ['asset-types', orgId],
    ({ signal }) => assetMasterApi.types(orgId, {}, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const units = useLookup(
    ['org-units', orgId, 'all'],
    ({ signal }) => orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const accounts = useLookup(
    ['vendor-accounts', orgId],
    ({ signal }) => assetMasterApi.vendorAccounts(orgId, {}, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const selectedType = (types.data || []).find((t) => t.code === typeCode)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !typeCode || !ownerUnitId) return

    setBusy(true)
    setError(null)
    try {
      const created = await assetsApi.register(orgId, {
        name: name.trim(),
        type_code: typeCode,
        owner_unit_id: ownerUnitId,
        criticality,
        serial_no: serialNo.trim() || undefined,
        location_details: locationDetails.trim() || undefined,
        vendor_account_id: vendorAccountId || undefined,
        acquired_on: acquiredOn || undefined,
        acquisition_cost: costAmount ? { amount: parseFloat(costAmount), currency: 'INR' } : undefined,
        expires_at: expiresAt || undefined,
        auto_renew: autoRenew,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      })
      invalidate(['assets', orgId])
      navigate(`/assets/${created.id}`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 840 }}>
      <div className="page-head">
        <div>
          <h1>Register New Asset</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Register an IT asset, hardware, digital license, or physical facility. An atomic asset tag will be generated automatically.
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <ErrorBanner error={error} />

      <form className="panel" onSubmit={handleSubmit}>
        <h3 style={{ marginTop: 0 }}>Basic Information</h3>
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <label className="field">
            <span>Asset Name *</span>
            <input
              type="text"
              required
              placeholder="e.g., MacBook Pro 16-inch M3 Max"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Asset Type *</span>
            <select required value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
              <option value="">Select asset type…</option>
              {(types.data || []).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.family})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Owning Department / Unit *</span>
            <select required value={ownerUnitId} onChange={(e) => setOwnerUnitId(e.target.value)}>
              <option value="">Select department / branch…</option>
              {(units.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.unit_type})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Criticality Level</span>
            <select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
              {Object.entries(CRITICALITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <h3 style={{ margin: '24px 0 12px' }}>Identification & Procurement</h3>
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <label className="field">
            <span>Serial Number</span>
            <input
              type="text"
              placeholder="e.g., C02G40E7MD6R"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Physical Location / Room</span>
            <input
              type="text"
              placeholder="e.g., Bengaluru HQ, Server Room Rack 4"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Vendor Account (Optional)</span>
            <select value={vendorAccountId} onChange={(e) => setVendorAccountId(e.target.value)}>
              <option value="">None / Not linked</option>
              {(accounts.data || []).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_identifier}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3 style={{ margin: '24px 0 12px' }}>Financials & Expiration</h3>
        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <label className="field">
            <span>Acquired On</span>
            <input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
          </label>

          <label className="field">
            <span>Acquisition Cost (INR)</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Warranty / Expiry Date</span>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRenew}
            onChange={(e) => setAutoRenew(e.target.checked)}
          />
          <span>
            <strong>Auto-renew contract / license:</strong> Mark if this asset automatically renews upon expiration.
          </span>
        </label>

        {selectedType?.attribute_schema?.properties && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 12px' }}>Custom Specifications ({selectedType.name})</h4>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {Object.entries(selectedType.attribute_schema.properties).map(([key, schema]) => (
                <label key={key} className="field">
                  <span>{schema.title || key}</span>
                  <input
                    type={schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text'}
                    value={attributes[key] ?? ''}
                    onChange={(e) =>
                      setAttributes({
                        ...attributes,
                        [key]: schema.type === 'number' ? parseFloat(e.target.value) : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="row-actions" style={{ marginTop: 24 }}>
          <button className="btn" disabled={busy} aria-busy={busy}>
            Register Asset
          </button>
          <button type="button" className="btn secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
