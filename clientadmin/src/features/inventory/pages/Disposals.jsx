import { useState } from 'react'
import { Link } from 'react-router-dom'
import { disposalsApi } from '@/features/inventory/api.js'
import ActionForm from '@/features/inventory/components/ActionForm.jsx'
import { DISPOSAL_METHOD_LABELS, formatDay as formatDate } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// Retired devices on their way out. A model that stores data needs the wipe certificate
// (uploaded to the device's Documents tab first; paste its document id here).
export default function Disposals() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [completing, setCompleting] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const { data, error: loadError, loading, reload } = useQuery(['disposals', orgId], ({ signal }) => disposalsApi.list(orgId, { limit: 100 }, { signal }), { enabled: Boolean(orgId) })
  async function act(name, call) {
    setBusy(name)
    setError(null)
    try {
      await call()
      invalidate(['disposals', orgId])
      invalidate(['devices', orgId])
      setCompleting(null)
      reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }
  const rows = data?.data ?? []
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Disposals</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Retire a device from its page, then request its disposal there.</p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>
      <ErrorBanner error={error || loadError} onRetry={reload} />
      {completing && (
        <ActionForm title={`Dispose of ${completing.device.code}`} busy={busy} onCancel={() => setCompleting(null)}
          fields={[
            { name: 'data_wiped', label: completing.device.stores_data ? 'Data wiped? (required for this model)' : 'Data wiped?', required: completing.device.stores_data, options: [['yes', 'Yes'], ['no', 'No']] },
            { name: 'certificate_document_id', label: 'Wipe / disposal certificate (document id)' },
            { name: 'recovered_value', label: 'Recovered value', type: 'number' },
          ]}
          onSubmit={(v) => act('complete', () => disposalsApi.complete(orgId, completing.id, { data_wiped: v.data_wiped === 'yes', certificate_document_id: v.certificate_document_id, recovered_value: v.recovered_value ? Number(v.recovered_value) : undefined }))} />
      )}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Device</th><th>Method</th><th>Status</th><th>Wiped</th><th>Requested</th><th /></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No disposals.</td></tr>
            ) : rows.map((d) => (
              <tr key={d.id}>
                <td><Link className="mono" to={`/inventory/devices/${d.device.id}`}>{d.device.code}</Link>{d.reason && <div className="muted small">{d.reason}</div>}</td>
                <td>{DISPOSAL_METHOD_LABELS[d.disposal_method]}</td>
                <td><StatusBadge status={d.status} /></td>
                <td>{d.data_wiped ? 'Yes' : d.device.stores_data ? <span className="error small">Needed</span> : 'No'}</td>
                <td className="muted small">{formatDate(d.created_at)}</td>
                <td>
                  <div className="row-actions">
                    {d.status === 'pending' && hasAccess(me, ACCESS.approveDisposals) && (
                      <>
                        <button className="btn" disabled={!!busy} onClick={() => act('approve', () => disposalsApi.decide(orgId, d.id, true))}>Approve</button>
                        <button className="btn secondary" disabled={!!busy} onClick={() => act('reject', () => disposalsApi.decide(orgId, d.id, false))}>Reject</button>
                      </>
                    )}
                    {d.status === 'approved' && hasAccess(me, ACCESS.manageDisposals) && <button className="btn" onClick={() => setCompleting(d)}>Record disposal</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
