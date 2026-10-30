import { useEffect, useState } from 'react'
import { getRoleChanges } from '../api.js'
import { toList } from '../utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import RoleChangeList from '../components/RoleChangeList.jsx'

const VIEWS = [
  ['pending,approved', 'Waiting'],
  ['', 'All'],
]

// Every promotion, demotion and transfer in the organization: what is waiting for approval, and the history.
export default function RoleChanges() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const { units } = useAccessCatalog(orgId)
  const [view, setView] = useState(VIEWS[0][0])
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const unitNames = Object.fromEntries((units || []).map((u) => [u.id, u.name]))

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setChanges(toList(await getRoleChanges(view ? { status: view } : {})))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [view])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Role changes</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Promotions, demotions and transfers. Someone other than the requester approves each one.
          </p>
        </div>
      </div>
      <ErrorBanner error={error} onRetry={load} />
      <div className="toolbar">
        <select value={view} onChange={(e) => setView(e.target.value)}>
          {VIEWS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
        </select>
      </div>
      <RoleChangeList
        changes={changes}
        loading={loading}
        me={user}
        canApprove={hasAccess(user, ACCESS.approveRoleChanges)}
        canRequest={hasAccess(user, ACCESS.manageEmployees)}
        showWorker
        unitName={(id) => unitNames[id] || 'another department'}
        onChanged={load}
      />
    </div>
  )
}
