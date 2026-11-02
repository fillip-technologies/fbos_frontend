import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getIdentitySync, requestIdentitySync } from '../api.js'
import { formatDateTime } from '../utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const STATUS = {
  in_sync: ['active', 'In sync'],
  pending: ['upcoming', 'Update waiting'],
  failed: ['expired', 'Not accepted'],
  drift: ['expiring', 'Differs'],
  not_synced: ['inactive', 'Not sent yet'],
}
const FIELD_LABELS = {
  name: 'Name', phone: 'Phone', employee_code: 'Employee code', home_unit_id: 'Department', manager_user_id: 'Manager',
  status: 'Login', access_role: 'Access role', login: 'Login',
}

// Whether the person's login matches their job: department, manager, access roles and whether they have left.
// People holds the HR facts and sends them to Identity; this shows where that stands and what differs.
export default function IdentitySyncPanel({ worker, canManage, unitName }) {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const query = useQuery(['identity-sync', orgId, worker.id], ({ signal }) => getIdentitySync(worker.id, { signal }), {
    enabled: Boolean(orgId && worker.user_id),
  })
  const sync = query.data

  const sendAgain = async () => {
    try {
      setSending(true)
      setError(null)
      await requestIdentitySync(worker.id)
      invalidate(['identity-sync', orgId, worker.id])
    } catch (err) {
      setError(err)
    } finally {
      setSending(false)
    }
  }

  const show = (field, value) => (field === 'home_unit_id' && value ? unitName(value) : value ?? 'nothing')
  return (
    <div className="panel">
      <div className="section-head">
        <h2 className="form-section" style={{ fontSize: 16 }}>Access</h2>
        {worker.user_id && hasAccess(user, ACCESS.users) && <Link to={`/users/${worker.user_id}`}>Manage access →</Link>}
      </div>
      {!worker.user_id ? (
        <p className="muted small">This person has no login. Their access is set up under Users once they are invited.</p>
      ) : query.loading ? (
        <PanelSkeleton lines={3} />
      ) : (
        <>
          <ErrorBanner error={query.error || error} onRetry={query.reload} />
          {sync && (
            <>
              <p style={{ margin: '0 0 8px' }}>
                <StatusBadge status={STATUS[sync.status]?.[0] || 'inactive'} label={STATUS[sync.status]?.[1] || sync.status} />{' '}
                <span className="muted small">
                  {sync.last_synced_at ? `Last sent ${formatDateTime(sync.last_synced_at)}` : 'Nothing sent yet'}
                  {sync.deactivated_at && ` · login ended ${formatDateTime(sync.deactivated_at)}`}
                </span>
              </p>
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                Department, manager, name, phone, employee code and the access this person’s posts bring are kept in step with their login.
                Roles granted by hand under Users are never touched.
              </p>
              {sync.last_error && <div className="alert error small">{sync.last_error}</div>}
              {sync.note && <p className="small">{sync.note}</p>}
              {sync.drift.length > 0 && (
                <table className="table-plain">
                  <thead><tr><th>What</th><th>People says</th><th>The login has</th></tr></thead>
                  <tbody>
                    {sync.drift.map((d, i) => (
                      <tr key={`${d.field}-${i}`}>
                        <td>{FIELD_LABELS[d.field] || d.field}</td>
                        <td>{show(d.field, d.people)}</td>
                        <td>{show(d.field, d.identity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {sync.drift.length > 0 && (
                <p className="muted small">Checked {formatDateTime(sync.drift_checked_at)}. Nothing is changed automatically.</p>
              )}
              {canManage && (
                <div className="row-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn secondary" onClick={sendAgain} disabled={sending} aria-busy={sending}>
                    Send again
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
