import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import UnitTree from '@/features/org-units/components/UnitTree.jsx'
import VerticalChips from '@/features/org-units/components/VerticalChips.jsx'
import '@/features/org-units/org-units.css'
import { breadcrumb, childTypesFor, sortedTree, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'

// Chart (an organisation chart, coloured by level) or List (the table): the choice is kept in this browser.
const VIEW_KEY = 'fbos_org_units_view'

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'map'
  } catch {
    return 'map'
  }
}

// The organization's structure, as an organisation chart or an indented table. The organization itself is the company:
// branches sit directly under it, then departments and teams.
export default function OrgUnits() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canCreate = hasAccess(user, ACCESS.createOrgUnit)

  const unitsQuery = useLookup(['org-units', orgId, 'all'], ({ signal }) => orgUnitsApi.listAll(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const verticalsQuery = useLookup(['verticals', orgId, 'options'], ({ signal }) =>
    orgUnitsApi.verticalOptions(orgId, { signal }).catch(() => []), { enabled: Boolean(orgId) }
  )
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data])
  // The people to draw on the chart; without permission to read users there are none.
  const peopleQuery = useLookup(['users', orgId, 'structure'], ({ signal }) => orgUnitsApi.listPeople(orgId, { signal }), {
    enabled: Boolean(orgId) && hasAccess(user, ACCESS.users),
  })
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data])
  const [showPeople, setShowPeople] = useState(true)
  // Archived verticals no longer apply anywhere, so they aren't shown.
  const verticalNames = useMemo(
    () => Object.fromEntries((verticalsQuery.data ?? []).filter((v) => v.status === 'active').map((v) => [v.id, v.name])),
    [verticalsQuery.data]
  )
  const { loading, error, reload } = unitsQuery
  const [showInactive, setShowInactive] = useState(false)
  const [q, setQ] = useState('')
  const [view, setView] = useState(readView)
  const chooseView = (next) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Not remembered across visits; the choice still applies now.
    }
  }
  const notice = location.state?.notice


  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const inactiveCount = units.filter((u) => u.status !== 'active').length
  // How many of each level, for the legend.
  const levelCounts = useMemo(() => {
    const out = { branch: 0, department: 0, team: 0 }
    for (const u of units) if (u.status === 'active') out[u.unit_type] = (out[u.unit_type] ?? 0) + 1
    return out
  }, [units])

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
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={reload} />

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
          <div className="toolbar ou-toolbar">
            <input placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search name or code" />
            <div className="segmented" role="group" aria-label="Show as">
              {[['map', 'Chart'], ['list', 'List']].map(([key, text]) => (
                <button key={key} type="button" className={view === key ? 'active' : ''} aria-pressed={view === key} onClick={() => chooseView(key)}>{text}</button>
              ))}
            </div>
            {people.length > 0 && view === 'map' && (
              <label className="inline-check">
                <input type="checkbox" checked={showPeople} onChange={(e) => setShowPeople(e.target.checked)} />
                People ({people.length})
              </label>
            )}
            {inactiveCount > 0 && (
              <label className="inline-check">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Inactive ({inactiveCount})
              </label>
            )}
            <div className="ou-legend" aria-label="What the colours mean">
              <span className="ou-key ou-branch"><i /> Branch · {levelCounts.branch}</span>
              <span className="ou-key ou-department"><i /> Department · {levelCounts.department}</span>
              <span className="ou-key ou-team"><i /> Team · {levelCounts.team}</span>
            </div>
            <span className="spacer" />
            {canCreate && <Link className="btn" to="/org-units/new">+ Add</Link>}
          </div>

          {view === 'map' ? (
            <UnitTree
              units={showInactive ? units : units.filter((u) => u.status === 'active')}
              unitsById={unitsById}
              verticalNames={verticalNames}
              canCreate={canCreate}
              term={term}
              loading={loading}
              companyName={activeOrg?.name}
              people={people}
              showPeople={showPeople}
            />
          ) : (
          <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Head</th>
                  <th>Verticals</th>
                  <th>Status</th>
                  {canCreate && <th />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={7} />
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="center-note">Nothing matches.</td></tr>
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
                        <td><span className={`ou-pill ou-${u.unit_type}`}>{UNIT_TYPE_LABELS[u.unit_type] || u.unit_type}</span></td>
                        <td>{u.head_user?.name || <span className="muted">—</span>}</td>
                        <td><VerticalChips unit={u} unitsById={unitsById} names={verticalNames} /></td>
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
          )}
        </>
      )}
    </div>
  )
}
