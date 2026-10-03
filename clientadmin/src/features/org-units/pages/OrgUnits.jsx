import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { breadcrumb, childTypesFor, sortedTree, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'

// The organization's structure, as an indented tree. The organization itself is the company:
// branches sit directly under it, then departments and teams.
export default function OrgUnits() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canCreate = hasAccess(user, ACCESS.createOrgUnit)

  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [q, setQ] = useState('')
  const notice = location.state?.notice

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    orgUnitsApi
      .listAll(orgId)
      .then(setUnits)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId])
  useEffect(load, [load])

  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const inactiveCount = units.filter((u) => u.status !== 'active').length

  // Searching shows a flat list of matches with their location; otherwise the tree.
  const term = q.trim().toLowerCase()
  const rows = useMemo(() => {
    const visible = showInactive ? units : units.filter((u) => u.status === 'active')
    if (!term) return sortedTree(visible)
    return visible
      .filter((u) => u.name.toLowerCase().includes(term) || u.code.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ ...u, depth: 0 }))
  }, [units, showInactive, term])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Company structure</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            How {activeOrg ? `“${activeOrg.name}”` : 'this company'} is organized into branches, departments and teams. Each person works
            in one of them, and access can be limited to one and everything under it.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {canCreate && units.length > 0 && <Link className="btn" to="/org-units/new">+ Add</Link>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={load} />

      {!loading && !error && units.length === 0 ? (
        <div className="panel empty-state">
          <h2>No branches yet</h2>
          <p className="muted">
            Start {activeOrg ? `“${activeOrg.name}”` : 'the company'} with a branch (an office or location), then add
            departments and teams under it.
          </p>
          {canCreate ? (
            <Link className="btn" to="/org-units/new?type=branch">+ Create the first branch</Link>
          ) : (
            <p className="muted small">Ask an administrator to set up the structure.</p>
          )}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input placeholder="Search name or code" value={q} style={{ minWidth: 240 }} onChange={(e) => setQ(e.target.value)} />
            {inactiveCount > 0 && (
              <label className="inline-check">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Show inactive ({inactiveCount})
              </label>
            )}
          </div>

          <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Head</th>
                  <th>Status</th>
                  {canCreate && <th />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="center-note">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="center-note">Nothing matches.</td></tr>
                ) : (
                  rows.map((u) => {
                    const childTypes = u.status === 'active' ? childTypesFor(u.unit_type) : []
                    return (
                      <tr key={u.id} onClick={() => navigate(`/org-units/${u.id}`)}>
                        <td>
                          <div className="tree-cell" style={{ paddingLeft: u.depth * 22 }}>
                            {u.depth > 0 && <span className="tree-branch" aria-hidden="true">└</span>}
                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                          </div>
                          {term && breadcrumb(u, unitsById).length > 0 && (
                            <div className="muted small">{breadcrumb(u, unitsById).map((a) => a.name).join(' › ')}</div>
                          )}
                        </td>
                        <td className="mono">{u.code}</td>
                        <td>{UNIT_TYPE_LABELS[u.unit_type] || u.unit_type}</td>
                        <td>{u.head_user?.name || <span className="muted">—</span>}</td>
                        <td><StatusBadge status={u.status} /></td>
                        {canCreate && (
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {childTypes.length > 0 && (
                              <button
                                className="link-btn"
                                title={`Add a ${childTypes.map((t) => UNIT_TYPE_LABELS[t].toLowerCase()).join(' or ')} under ${u.name}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/org-units/new?parent=${u.id}`)
                                }}
                              >
                                + Add under
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
