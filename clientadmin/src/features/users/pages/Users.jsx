import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { usersApi } from '@/features/users/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { formatDate, formatDateTime, USER_TYPE_LABELS } from '@/features/users/utils.js'
import { getWorkersByUsers } from '@/features/people/api.js'
import { statusLabel } from '@/features/people/utils.js'
import EmployeeDirectory from '@/features/people/pages/EmployeeDirectory.jsx'
import ImportFromUsersModal from '@/features/people/components/ImportFromUsersModal.jsx'

const STATUSES = ['', 'invited', 'active', 'suspended', 'deactivated']

// Users and employees: one list of everyone. Logins come from Identity; the Employee column and the
// "Without a login" view come from People, for viewers who may read employees.
export default function Users() {
  const { user: me } = useAuth()
  // Someone who may read employees but not users still gets the employee directory.
  if (!hasAccess(me, ACCESS.users)) return <Navigate to="/people/employees" replace />
  return <UsersAndEmployees />
}

function UsersAndEmployees() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canSeeEmployees = hasAccess(me, ACCESS.people)
  const canManageEmployees = hasAccess(me, ACCESS.manageEmployees)
  const [searchParams, setSearchParams] = useSearchParams()
  const view = canSeeEmployees && searchParams.get('view') === 'no-login' ? 'no-login' : 'logins'
  const [importOpen, setImportOpen] = useState(false)
  const { roles, units } = useAccessCatalog(orgId)

  const [filters, setFilters] = useState({ status: '', unit_id: null, role_code: '' })
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const notice = location.state?.notice

  const { data, error, loading, refreshing, reload } = useQuery(
    ['users', orgId, { cursor, query, filters }],
    ({ signal }) => usersApi.list(orgId, { limit: 25, cursor, q: query, ...filters, unit_id: filters.unit_id || undefined }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const users = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null
  // The employee record of each user on this page, when there is one.
  const userIds = users.map((u) => u.id)
  const workersQuery = useQuery(
    ['workers-by-users', orgId, userIds],
    ({ signal }) => getWorkersByUsers(userIds, { signal }),
    { enabled: Boolean(orgId) && canSeeEmployees && userIds.length > 0, keepPrevious: true }
  )
  const workerOf = Object.fromEntries((workersQuery.data?.data ?? []).map((w) => [w.user_id, w]))

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
          <h1>Users and employees</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everyone at {activeOrg ? `“${activeOrg.name}”` : 'this company'}: their login and access, and their employee record.
            Open someone to see it all on one page.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {view === 'logins' && canManageEmployees && (
            <button type="button" className="btn secondary" onClick={() => setImportOpen(true)}>Make employees</button>
          )}
          {view === 'logins' && hasAccess(me, ACCESS.inviteUsers) && <Link className="btn" to="/users/new">+ Invite user</Link>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}

      {canSeeEmployees && (
        <div className="tab-bar" role="tablist">
          {[['logins', 'With a login'], ['no-login', 'Employees without a login']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={view === key ? 'active' : ''}
              onClick={() => setSearchParams(key === 'no-login' ? { view: key } : {}, { replace: true })}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'no-login' ? (
        <EmployeeDirectory embedded hasLogin={false} />
      ) : (<>

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
        <UnitSelect units={units} value={filters.unit_id} emptyLabel="Anywhere" onChange={(id) => setFilter('unit_id', id)} />
        <select value={filters.role_code} onChange={(e) => setFilter('role_code', e.target.value)}>
          <option value="">Any role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.code}>{r.name}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Employee code</th>
              <th>Type</th>
              <th>Works in</th>
              <th>Manager</th>
              <th>Status</th>
              {canSeeEmployees && <th>Employee</th>}
              <th>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canSeeEmployees ? 8 : 7} />
            ) : users.length === 0 ? (
              <tr><td colSpan={canSeeEmployees ? 8 : 7} className="center-note">No users found.</td></tr>
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
                  {canSeeEmployees && (
                    <td>
                      {workerOf[u.id] ? (
                        <>
                          <div>{workerOf[u.id].designation}</div>
                          <StatusBadge status={workerOf[u.id].status} label={statusLabel(workerOf[u.id].status)} />
                        </>
                      ) : workersQuery.loading || workersQuery.refreshing ? (
                        <span className="muted small">…</span>
                      ) : (
                        <span className="muted small">Not an employee</span>
                      )}
                    </td>
                  )}
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
      </>)}

      {importOpen && (
        <ImportFromUsersModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            invalidate(['workers-by-users', orgId])
            workersQuery.reload()
          }}
        />
      )}
    </div>
  )
}
