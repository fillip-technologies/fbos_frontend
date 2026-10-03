import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { formatDate, formatDateTime, USER_TYPE_LABELS } from '@/features/users/utils.js'

const STATUSES = ['', 'invited', 'active', 'suspended', 'deactivated']

export default function Users() {
  const navigate = useNavigate()
  const location = useLocation()
  const { orgId, activeOrg } = useActiveOrg()
  const { roles, units } = useAccessCatalog(orgId)

  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ status: '', unit_id: null, role_code: '' })
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const notice = location.state?.notice

  function load() {
    if (!orgId) return
    setLoading(true)
    setError(null)
    usersApi
      .list(orgId, { limit: 25, cursor, q: query, ...filters, unit_id: filters.unit_id || undefined })
      .then((res) => {
        setUsers(res.data)
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }
  useEffect(load, [orgId, cursor, query, filters])

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (k, v) => {
    resetPaging()
    setFilters((f) => ({ ...f, [k]: v }))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Employees, contractors and client users of {activeOrg ? `“${activeOrg.name}”` : 'this organization'}, with
            the access each one holds.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          <Link className="btn" to="/users/new">+ Invite user</Link>
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}

      <div className="toolbar">
        <input
          placeholder="Search name, email or employee code"
          value={q}
          style={{ minWidth: 260 }}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              resetPaging()
              setQuery(q.trim())
            }
          }}
        />
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'}</option>
          ))}
        </select>
        <UnitSelect units={units} value={filters.unit_id} emptyLabel="All units" onChange={(id) => setFilter('unit_id', id)} />
        <select value={filters.role_code} onChange={(e) => setFilter('role_code', e.target.value)}>
          <option value="">Any role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.code}>{r.name}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={load} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Employee code</th>
              <th>Type</th>
              <th>Home unit</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="center-note">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} onClick={() => navigate(`/users/${u.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td className="mono">{u.employee_code || '—'}</td>
                  <td>{USER_TYPE_LABELS[u.user_type] || u.user_type}</td>
                  <td>{u.home_unit?.name || <span className="muted">—</span>}</td>
                  <td>{u.manager?.name || <span className="muted">—</span>}</td>
                  <td>
                    <StatusBadge status={u.status} />
                    {u.status === 'invited' && u.invitation_expires_at && (
                      <div className="muted small">link expires {formatDateTime(u.invitation_expires_at)}</div>
                    )}
                  </td>
                  <td className="muted small">{u.last_login_at ? formatDateTime(u.last_login_at) : `added ${formatDate(u.created_at)}`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || !next}
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
