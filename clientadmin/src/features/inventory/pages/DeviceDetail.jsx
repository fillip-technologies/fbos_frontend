import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { devicesApi } from '@/features/inventory/api.js'
import { HealthBadge, LifecycleBadge, WarrantyBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import DeviceActions from '@/features/inventory/components/DeviceActions.jsx'
import DeviceTimeline from '@/features/inventory/components/DeviceTimeline.jsx'
import {
  LIFECYCLE_LABELS,
  LOCATION_TYPE_LABELS,
  OWNERSHIP_LABELS,
  formatMoneyValue,
} from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton, PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDay as formatDate } from '@/features/inventory/utils.js'

const TABS = [
  ['overview', 'Overview'],
  ['timeline', 'Timeline'],
  ['installations', 'Installations'],
  ['warranty', 'Warranty'],
  ['documents', 'Documents'],
]

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  const { orgId } = useActiveOrg()

  const { data: device, error, loading, reload } = useQuery(
    ['device', orgId, id],
    ({ signal }) => devicesApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )

  if (loading) return <DetailSkeleton />
  if (!device)
    return (
      <div>
        <ErrorBanner error={error} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/inventory/devices')}>← Back</button>
      </div>
    )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {device.name} <LifecycleBadge state={device.lifecycle_state} /> <HealthBadge health={device.health_status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{device.code}</span>
            {device.model && ` · ${device.model.name}`}
            {device.serial_number && <> · S/N <span className="mono">{device.serial_number}</span></>}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

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

      {tab === 'overview' && (
        <>
          <DeviceActions orgId={orgId} device={device} onChanged={() => { reload(); invalidate(['device', orgId, device.id]) }} />
          <DeviceOverview device={device} />
        </>
      )}
      {tab === 'timeline' && <DeviceTimeline orgId={orgId} deviceId={device.id} />}
      {tab === 'installations' && <DeviceInstallations orgId={orgId} deviceId={device.id} />}
      {tab === 'warranty' && <DeviceWarranties orgId={orgId} device={device} />}
      {tab === 'documents' && <DeviceDocuments orgId={orgId} device={device} />}
    </div>
  )
}

function DeviceOverview({ device }) {
  const where = device.zone
    ? `${device.zone.name}${device.site ? ` · ${device.site.name}` : ''}`
    : device.location
      ? `${device.location.name} (${LOCATION_TYPE_LABELS[device.location.location_type] ?? device.location.location_type})`
      : null
  return (
    <div className="panel">
      <div className="details-grid">
        <Detail label="State">{LIFECYCLE_LABELS[device.lifecycle_state]}</Detail>
        <Detail label="Where it is">{where ?? (device.lifecycle_state === 'in_transit' ? 'On a transfer' : null)}</Detail>
        <Detail label="Held by">{device.customer?.name}{device.site && ` / ${device.site.name}`}</Detail>
        <Detail label="Owner">{OWNERSHIP_LABELS[device.ownership_type]}</Detail>
        <Detail label="Installed">
          {device.installation &&
            `${formatDate(device.installation.installed_at)}${device.installation.position_label ? ` · ${device.installation.position_label}` : ''}`}
        </Detail>
        <Detail label="First installed">{formatDate(device.first_install_date)}</Detail>
        <Detail label="Warranty"><WarrantyBadge endDate={device.warranty_end_date} />{device.warranty_end_date && ` until ${formatDate(device.warranty_end_date)}`}</Detail>
        <Detail label="Condition">{device.condition}</Detail>
        <Detail label="Repairs">{device.repair_count > 0 ? String(device.repair_count) : 'None'}</Detail>
        <Detail label="MAC address">{device.mac_address && <span className="mono">{device.mac_address}</span>}</Detail>
        <Detail label="Received">{formatDate(device.received_at)}</Detail>
        {'unit_price' in device && <Detail label="Unit price">{formatMoneyValue(device.unit_price)}</Detail>}
      </div>
    </div>
  )
}

function DeviceInstallations({ orgId, deviceId }) {
  const { data, error, loading, reload } = useQuery(
    ['device', orgId, deviceId, 'installations'],
    ({ signal }) => devicesApi.installations(orgId, deviceId, { signal }),
    { enabled: Boolean(orgId) }
  )
  if (loading) return <PanelSkeleton />
  const rows = data?.data ?? []
  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <ErrorBanner error={error} onRetry={reload} />
      <table>
        <thead>
          <tr><th>Zone</th><th>Kind</th><th>Installed</th><th>Removed</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="center-note">Never installed.</td></tr>
          ) : (
            rows.map((i) => (
              <tr key={i.id}>
                <td>{i.zone.name}{i.position_label && <div className="muted small">{i.position_label}</div>}</td>
                <td className="muted small">{i.installation_type.replace(/_/g, ' ')}</td>
                <td>{formatDate(i.installed_at)}</td>
                <td>{i.removed_at ? <>{formatDate(i.removed_at)}{i.removal_reason && <div className="muted small">{i.removal_reason}</div>}</> : '—'}</td>
                <td><StatusBadge status={i.status === 'active' ? 'active' : 'closed'} label={i.status === 'active' ? 'Current' : 'Past'} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function DeviceWarranties({ orgId, device }) {
  const { user: me } = useAuth()
  const allowed = hasAccess(me, ACCESS.warranties)
  const { data, error, loading, reload } = useQuery(
    ['device', orgId, device.id, 'warranties'],
    ({ signal }) => devicesApi.warranties(orgId, device.id, { signal }),
    { enabled: Boolean(orgId) && allowed }
  )
  if (!allowed) return <div className="panel muted">You don't have access to warranties.</div>
  if (loading) return <PanelSkeleton />
  const rows = data?.data ?? []
  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <ErrorBanner error={error} onRetry={reload} />
      <table>
        <thead>
          <tr><th>Cover</th><th>From</th><th>Until</th><th>Starts on</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="center-note">No warranty recorded. Devices received through a goods receipt get one automatically.</td></tr>
          ) : (
            rows.map((w) => (
              <tr key={w.id}>
                <td>{w.warranty_type}{w.coverage && <div className="muted small">{w.coverage}</div>}</td>
                <td>{formatDate(w.start_date)}</td>
                <td>{formatDate(w.end_date)}</td>
                <td className="muted small">{w.start_basis === 'install_date' ? 'Install date' : 'Receipt date'}</td>
                <td><StatusBadge status={w.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function DeviceDocuments({ orgId, device }) {
  const { user: me } = useAuth()
  const [linkError, setLinkError] = useState(null)
  if (!hasAccess(me, ACCESS.documents)) return <div className="panel muted">You don't have access to documents.</div>
  return (
    <>
      <ErrorBanner error={linkError} />
      <DocumentPanel
        orgId={orgId}
        subjectType={DOCUMENT_SUBJECTS.device}
        subjectId={device.id}
        canAttach={hasAccess(me, ACCESS.manageDevices) && hasAccess(me, ACCESS.uploadDocuments)}
        emptyText="No invoices, warranty cards or photos attached yet."
        onUploaded={(doc) => devicesApi.linkDocument(orgId, device.id, { document_id: doc.id, doc_type: 'other' }).catch(setLinkError)}
      />
    </>
  )
}
