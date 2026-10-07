import { useState } from 'react'
import { projectsApi } from '@/features/delivery/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'

const ROLES = { manager: 'Manager', lead: 'Lead', member: 'Member', viewer: 'Viewer' }

export default function ProjectTeam({ orgId, project, setProject, names }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageProjects)
  const { data: members = [], error, loading, reload, setData } = useQuery(
    ['project', orgId, project.id, 'members'],
    ({ signal }) => projectsApi.members(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [rows, setRows] = useState(null) // the team being edited, or null
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const people = names.people || [me].filter(Boolean)

  const startEditing = () =>
    setRows(members.map((m) => ({ user_id: m.user.id, member_role: m.member_role, allocation_pct: m.allocation_pct })))
  const setRow = (index, key, value) => setRows((list) => list.map((r, i) => (i === index ? { ...r, [key]: value } : r)))

  async function save() {
    setSaveError(null)
    setBusy(true)
    try {
      const team = rows
        .filter((r) => r.user_id)
        .map((r) => ({ user_id: r.user_id, member_role: r.member_role, allocation_pct: Number(r.allocation_pct) || 100 }))
      setProject(await projectsApi.replaceMembers(orgId, project, team))
      setData(await projectsApi.members(orgId, project.id))
      setRows(null)
    } catch (err) {
      setSaveError(err)
    } finally {
      setBusy(false)
    }
  }

  if (rows) {
    return (
      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Edit the team</h2>
        <ErrorBanner error={saveError} />
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Time on this project</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={index} style={{ cursor: 'default' }}>
                <td>
                  <select aria-label="Person" value={r.user_id} onChange={(e) => setRow(index, 'user_id', e.target.value)}>
                    <option value="">— Choose —</option>
                    {people.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                    {r.user_id && !people.some((u) => u.id === r.user_id) && <option value={r.user_id}>{names.personName(r.user_id)}</option>}
                  </select>
                </td>
                <td>
                  <select aria-label="Role" value={r.member_role} onChange={(e) => setRow(index, 'member_role', e.target.value)}>
                    {Object.entries(ROLES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label="Allocation percent"
                    type="number"
                    min={1}
                    max={100}
                    style={{ width: 80 }}
                    value={r.allocation_pct}
                    onChange={(e) => setRow(index, 'allocation_pct', e.target.value)}
                  />{' '}
                  %
                </td>
                <td>
                  <button className="btn secondary small-btn" type="button" onClick={() => setRows((list) => list.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn secondary" type="button" onClick={() => setRows((list) => [...list, { user_id: '', member_role: 'member', allocation_pct: 100 }])}>
            + Add person
          </button>
          <button className="btn" type="button" disabled={busy} aria-busy={busy} onClick={save}>Save team</button>
          <button className="btn secondary" type="button" onClick={() => setRows(null)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Time on this project</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={4} rows={3} />
            ) : members.length === 0 ? (
              <tr><td colSpan={4} className="center-note">Nobody is on the team yet.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.user.id} style={{ cursor: 'default' }}>
                  <td>{names.personName(m.user)}</td>
                  <td>{ROLES[m.member_role] || m.member_role}</td>
                  <td>{Math.round(m.allocation_pct)}%</td>
                  <td className="muted small">{formatDate(m.valid_from)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {canManage && !loading && (
        <button className="btn secondary" onClick={startEditing}>Edit team</button>
      )}
    </>
  )
}
