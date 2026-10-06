import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { projectsApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { HEALTH_LABELS, PROJECT_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { prefetch, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

const NO_FILTERS = { status: '', health: '', manager_user_id: '', client_id: '', q: '' }

export default function Projects() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)

  const [filters, setFilters] = useState(NO_FILTERS)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['projects', orgId, { cursor, filters }],
    ({ signal }) => projectsApi.list(orgId, { limit: 25, cursor, ...filters }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const projects = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (key, value) => {
    resetPaging()
    setFilters((f) => ({ ...f, [key]: value }))
  }
  const warm = (id) => prefetch(['project', orgId, id], ({ signal }) => projectsApi.get(orgId, id, { signal }))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The work {activeOrg ? `“${activeOrg.name}”` : 'this company'} delivers: for customers, on retainer, or internal.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {hasAccess(me, ACCESS.manageProjects) && <Link className="btn" to="/projects/new">+ New project</Link>}
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name or code"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.health} onChange={(e) => setFilter('health', e.target.value)}>
          <option value="">Any health</option>
          {Object.entries(HEALTH_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {names.people && (
          <select value={filters.manager_user_id} onChange={(e) => setFilter('manager_user_id', e.target.value)}>
            <option value="">Any manager</option>
            {names.people.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
          </select>
        )}
        {names.customers?.length > 0 && (
          <select value={filters.client_id} onChange={(e) => setFilter('client_id', e.target.value)}>
            <option value="">Any customer</option>
            {names.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Customer</th>
              <th>Manager</th>
              <th>Team</th>
              <th>Status</th>
              <th>Health</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : projects.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No projects found.</td></tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} onMouseEnter={() => warm(p.id)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="muted small">
                      <span className="mono">{p.code}</span> · {p.type.name}
                    </div>
                  </td>
                  <td>{p.client ? names.customerName(p.client) : <span className="muted">Internal</span>}</td>
                  <td>{names.personName(p.manager)}</td>
                  <td>{names.unitName(p.owning_unit)}</td>
                  <td><StatusBadge status={p.status} label={PROJECT_STATUS_LABELS[p.status]} /></td>
                  <td><StatusBadge status={p.health} label={HEALTH_LABELS[p.health]} /></td>
                  <td className="muted small">{formatDate(p.planned_end)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
