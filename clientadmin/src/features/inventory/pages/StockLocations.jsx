import { useState } from 'react'
import { Link } from 'react-router-dom'
import { inventoryPlacesApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { LOCATION_TYPE_LABELS } from '@/features/inventory/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton, TableSkeleton } from '@/shared/components/Skeleton.jsx'

// The three stock tiers (warehouse → customer store → site store) and the places a device
// can be away at (vendor, service centre, disposal), with what each one holds now.
export default function StockLocations() {
  const { orgId } = useActiveOrg()
  const [type, setType] = useState('')
  const [openId, setOpenId] = useState(null)
  const { data, error, loading, reload } = useQuery(
    ['stock-locations', orgId],
    ({ signal }) => inventoryPlacesApi.locations(orgId, {}, { signal }),
    { enabled: Boolean(orgId) }
  )
  const rows = (data ?? []).filter((l) => !type || l.location_type === type)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Stock</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Stores and what is in them. Open one to see its stock per model.</p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>
      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Every kind of place</option>
          {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Place</th><th>Kind</th><th>Devices here</th><th /></tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={4} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="center-note">No stores.</td></tr>
            ) : (
              rows.map((l) => (
                <LocationRow key={l.id} orgId={orgId} location={l} open={openId === l.id} onToggle={() => setOpenId(openId === l.id ? null : l.id)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LocationRow({ orgId, location, open, onToggle }) {
  return (
    <>
      <tr onClick={onToggle}>
        <td>
          <div style={{ fontWeight: 600 }}>{location.name}</div>
          <div className="muted small mono">{location.code}</div>
        </td>
        <td>{LOCATION_TYPE_LABELS[location.location_type]}</td>
        <td>{location.device_count}</td>
        <td>
          <Link to={`/inventory/devices?location_id=${location.id}`} onClick={(e) => e.stopPropagation()}>Devices</Link>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} style={{ background: 'var(--surface-2, #f8fafc)' }}>
            <StockOnHand orgId={orgId} locationId={location.id} />
          </td>
        </tr>
      )}
    </>
  )
}

function StockOnHand({ orgId, locationId }) {
  const { data, error, loading } = useQuery(
    ['stock-location', orgId, locationId, 'stock'],
    ({ signal }) => inventoryPlacesApi.stock(orgId, locationId, { signal }),
    { enabled: Boolean(orgId) }
  )
  if (loading) return <PanelSkeleton lines={2} />
  if (error) return <ErrorBanner error={error} />
  if (!data.data.length) return <span className="muted small">Nothing in stock here.</span>
  return (
    <table>
      <tbody>
        {data.data.map((row) => (
          <tr key={`${row.model?.id}-${row.lifecycle_state}`}>
            <td>{row.model?.name ?? 'No model'}</td>
            <td><LifecycleBadge state={row.lifecycle_state} /></td>
            <td style={{ fontWeight: 600 }}>{row.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
