import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { assetsApi } from '@/features/assets/api.js'
import AssetActions from '@/features/assets/components/AssetActions.jsx'
import { AssetStatusBadge, CriticalityBadge } from '@/features/assets/components/AssetBadge.jsx'
import {
  AssetCosts,
  AssetCustodyHistory,
  AssetMaintenance,
  AssetOverview,
  AssetRelationships,
  AssetRenewals,
} from '@/features/assets/components/AssetTabs.jsx'
import { CRITICALITY_LABELS } from '@/features/assets/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'

const TABS = [
  ['overview', 'Overview'],
  ['history', 'Custody History'],
  ['maintenance', 'Maintenance'],
  ['renewals', 'Renewals'],
  ['costs', 'Costs & TCO'],
  ['relationships', 'Topology'],
]

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  const [editing, setEditing] = useState(false)

  const { data: asset, error, loading, reload } = useQuery(
    ['asset', orgId, id],
    ({ signal }) => assetsApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId && id) }
  )

  const canManage = hasAccess(me, ACCESS.manageAssets)

  if (loading) return <DetailSkeleton />
  if (!asset) {
    return (
      <div>
        <ErrorBanner error={error} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/assets')}>
          ← Back to Assets
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{asset.name}</h1>
            <AssetStatusBadge status={asset.status} />
            <CriticalityBadge criticality={asset.criticality} />
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            <span className="mono" style={{ fontWeight: 600 }}>{asset.asset_tag}</span>
            {asset.type && ` · ${asset.type.name} (${asset.type.family})`}
            {asset.serial_no && <> · S/N <span className="mono">{asset.serial_no}</span></>}
          </p>
        </div>
        <div className="row-actions">
          {canManage && asset.status !== 'disposed' && !editing && (
            <button className="btn secondary" onClick={() => setEditing(true)}>
              Edit Specs
            </button>
          )}
          <button className="btn secondary" onClick={() => navigate('/assets')}>
            ← Back
          </button>
        </div>
      </div>

      {editing ? (
        <EditAssetForm
          orgId={orgId}
          asset={asset}
          onDone={() => {
            setEditing(false)
            reload()
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <AssetActions
          orgId={orgId}
          asset={asset}
          onChanged={() => {
            reload()
            invalidate(['assets', orgId])
          }}
        />
      )}

      <div className="version-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <AssetOverview orgId={orgId} asset={asset} />}
      {tab === 'history' && <AssetCustodyHistory orgId={orgId} assetId={asset.id} />}
      {tab === 'maintenance' && <AssetMaintenance orgId={orgId} assetId={asset.id} onAssetChanged={reload} />}
      {tab === 'renewals' && <AssetRenewals orgId={orgId} assetId={asset.id} onAssetChanged={reload} />}
      {tab === 'costs' && <AssetCosts orgId={orgId} assetId={asset.id} />}
      {tab === 'relationships' && <AssetRelationships orgId={orgId} assetId={asset.id} />}
    </div>
  )
}

function EditAssetForm({ orgId, asset, onDone, onCancel }) {
  const [name, setName] = useState(asset.name || '')
  const [criticality, setCriticality] = useState(asset.criticality || 'medium')
  const [serialNo, setSerialNo] = useState(asset.serial_no || '')
  const [locationDetails, setLocationDetails] = useState(asset.location_details || '')
  const [ownerUnitId, setOwnerUnitId] = useState(asset.owner_unit?.id || '')
  const [expiresAt, setExpiresAt] = useState(asset.expires_at || '')
  const [autoRenew, setAutoRenew] = useState(Boolean(asset.auto_renew))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const units = useLookup(
    ['org-units', orgId, 'all'],
    ({ signal }) => orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await assetsApi.update(orgId, asset, {
        name: name.trim() || undefined,
        criticality,
        serial_no: serialNo.trim() || undefined,
        location_details: locationDetails.trim() || undefined,
        owner_unit_id: ownerUnitId || undefined,
        expires_at: expiresAt || undefined,
        auto_renew: autoRenew,
      })
      invalidate(['assets', orgId])
      invalidate(['asset', orgId, asset.id])
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Edit Specifications: {asset.asset_tag}</h3>
      <ErrorBanner error={error} />
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Asset Name</span>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span>Owning Department / Unit</span>
          <select value={ownerUnitId} onChange={(e) => setOwnerUnitId(e.target.value)}>
            <option value="">None / Unassigned</option>
            {(units.data || []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Criticality</span>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
            {Object.entries(CRITICALITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Serial Number</span>
          <input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
        </label>

        <label className="field">
          <span>Location Details</span>
          <input type="text" value={locationDetails} onChange={(e) => setLocationDetails(e.target.value)} />
        </label>

        <label className="field">
          <span>Warranty / Expiry Date</span>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
        <span>Auto-renew enabled</span>
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Save Changes</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
