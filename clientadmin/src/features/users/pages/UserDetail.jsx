import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { usersApi } from '@/features/users/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ACCESS, hasAccess, isClientAdmin } from '@/features/auth/access.js'
import UserSessions from '@/features/sessions/components/UserSessions.jsx'
import AccessEditor, { accessFromGrants } from '@/features/access/components/AccessEditor.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import {
  actionLabel,
  entityLabel,
  parseCode,
  scopeLabel,
  serviceLabel,
  toRequestAccess,
} from '@/features/access/permissions.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDateTime, USER_TYPE_LABELS } from '@/features/users/utils.js'

function Detail({ label, children }) {
  return (
    <div className="detail">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function UserDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const { catalog, roles, units } = useAccessCatalog(orgId)

  const [user, setUser] = useState(null)
  const [access, setAccess] = useState(null) // GET /users/{id}/permissions
  const [presets, setPresets] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [mode, setMode] = useState(null) // 'edit' | 'deactivate' | 'access'

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    Promise.all([
      usersApi.get(orgId, id),
      usersApi.permissions(orgId, id).catch(() => null),
      usersApi.roleAssignments(orgId, id).catch(() => []),
      usersApi.list(orgId, { limit: 100, status: 'active' }).catch(() => ({ data: [] })),
    ])
      .then(([u, perms, assignments, actives]) => {
        setUser(u)
        setAccess(perms)
        setPresets(assignments)
        setManagers(actives.data.filter((m) => m.id !== id))
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const describe = useMemo(() => Object.fromEntries(catalog.map((p) => [p.code, p.description])), [catalog])

  async function resend() {
    setError(null)
    try {
      const inv = await usersApi.resendInvitation(orgId, id)
      setNotice(`A new invitation was emailed to ${inv.email}. It is valid until ${formatDateTime(inv.expires_at)}; the previous link no longer works.`)
      load()
    } catch (err) {
      setError(err)
    }
  }

  const done = (message) => {
    setMode(null)
    setNotice(message)
    load()
  }

  if (loading && !user) return <div className="center-note">Loading…</div>
  if (!user)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <Link className="btn secondary" to="/users">← Back to users</Link>
      </div>
    )

  const isSelf = me?.id === user.id
  const isDeactivated = user.status === 'deactivated'
  const isTenantAdmin = user.user_type === 'client_admin'
  const allowed = {
    resend: hasAccess(me, ACCESS.inviteUsers),
    edit: hasAccess(me, ACCESS.updateUsers),
    deactivate: hasAccess(me, ACCESS.deactivateUsers),
    editAccess: hasAccess(me, ACCESS.manageUserAccess),
    viewSessions: hasAccess(me, ACCESS.viewUserSessions),
    // Only a client admin can sign out a client admin (the backend enforces the same).
    signOutSessions: hasAccess(me, ACCESS.revokeUserSessions) && (!isTenantAdmin || isClientAdmin(me)),
    securityLog: hasAccess(me, ACCESS.auditLog),
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {user.name} <StatusBadge status={user.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {USER_TYPE_LABELS[user.user_type] || user.user_type} · {user.email}
          </p>
        </div>
        <Link className="btn secondary" to="/users">← Back</Link>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {mode === null && <ErrorBanner error={error} />}

      {user.status === 'invited' && (
        <div className="alert info invite-banner">
          <span>
            Waiting for {user.name} to activate their account.{' '}
            {user.invitation_expires_at && new Date(user.invitation_expires_at) < new Date()
              ? 'The invitation link has expired.'
              : `The link expires ${formatDateTime(user.invitation_expires_at)}.`}
          </span>
          {allowed.resend && <button className="btn secondary" onClick={resend}>Resend invitation</button>}
        </div>
      )}

      {/* ---------------- Profile ---------------- */}
      <div className="panel form-section">
        <div className="section-head">
          <h2>Profile</h2>
          {!isDeactivated && mode !== 'edit' && (
            <div className="row-actions">
              {allowed.edit && <button className="btn secondary" onClick={() => setMode('edit')}>Edit profile</button>}
              {!isSelf && allowed.deactivate && (
                <button className="btn danger-outline" onClick={() => setMode('deactivate')}>Deactivate</button>
              )}
            </div>
          )}
        </div>
        {mode === 'edit' ? (
          <ProfileForm orgId={orgId} user={user} units={units} managers={managers} onCancel={() => setMode(null)} onSaved={() => done('Profile saved.')} />
        ) : (
          <div className="details-grid">
            <Detail label="Email">{user.email}</Detail>
            <Detail label="Phone">{user.phone}</Detail>
            <Detail label="Employee code">{user.employee_code && <span className="mono">{user.employee_code}</span>}</Detail>
            <Detail label="User type">{USER_TYPE_LABELS[user.user_type] || user.user_type}</Detail>
            <Detail label="Works in">{user.home_unit && `${user.home_unit.name} (${user.home_unit.unit_type})`}</Detail>
            <Detail label="Reports to">{user.manager && <Link to={`/users/${user.manager.id}`}>{user.manager.name}</Link>}</Detail>
            <Detail label="Two-factor sign-in">{user.mfa_enabled ? 'Enabled' : 'Not set up'}</Detail>
            <Detail label="Last sign-in">{user.last_login_at && formatDateTime(user.last_login_at)}</Detail>
            <Detail label="Added">{formatDateTime(user.created_at)}</Detail>
          </div>
        )}
        {mode === 'deactivate' && (
          <DeactivateForm orgId={orgId} user={user} candidates={managers} onCancel={() => setMode(null)} onDone={() => done(`${user.name} was deactivated and signed out everywhere.`)} />
        )}
      </div>

      {/* ---------------- Access ---------------- */}
      <div className="panel form-section">
        <div className="section-head">
          <div>
            <h2>Access</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              What this user can do. Every action is checked against these permissions on the server.
            </p>
          </div>
          {allowed.editAccess && !isTenantAdmin && !isDeactivated && !isSelf && mode !== 'access' && access && (
            <button className="btn secondary" onClick={() => setMode('access')}>Edit access</button>
          )}
        </div>

        {isTenantAdmin ? (
          <div className="alert info">Client administrators have full access to every company of your account. Their access can't be narrowed.</div>
        ) : !access ? (
          <p className="muted">You don't have permission to view this user's access.</p>
        ) : mode === 'access' ? (
          <AccessForm
            orgId={orgId}
            user={user}
            grants={access.permissions}
            catalog={catalog}
            roles={roles}
            units={units}
            onCancel={() => setMode(null)}
            onSaved={() => done('Access updated. It applies to their very next request.')}
          />
        ) : (
          <>
            {presets.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="detail-label">Role presets applied</div>
                <div className="chips">
                  {presets.map((a) => (
                    <span key={a.id} className="chip" title={a.granted_by ? `Applied by ${a.granted_by.name}` : undefined}>
                      {a.role.name} · {a.scope_unit ? `${a.scope_unit.name} and below` : 'whole company'}
                      {a.self_only ? ' · own records' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <GrantsTable grants={access.permissions} unitsById={unitsById} describe={describe} />
          </>
        )}
      </div>

      {/* ---------------- Sessions ---------------- */}
      {allowed.viewSessions && isSelf && (
        <div className="panel form-section">
          <h2>Sessions</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Your own sessions are on <Link to="/profile">your profile</Link>.
          </p>
        </div>
      )}
      {allowed.viewSessions && !isSelf && (
        <UserSessions
          orgId={orgId}
          user={user}
          canSignOut={allowed.signOutSessions}
          logLink={allowed.securityLog ? `/audit-log?user=${user.id}` : null}
        />
      )}
    </div>
  )
}

function GrantsTable({ grants, unitsById, describe }) {
  if (grants.length === 0) {
    return <p className="muted">No permissions yet. This user can sign in but can't open anything.</p>
  }
  // Group rows by service, then entity, in code order.
  const sorted = [...grants].sort((a, b) => a.code.localeCompare(b.code))
  let lastGroup = null
  return (
    <table className="compact">
      <thead>
        <tr>
          <th>Permission</th>
          <th>Scope</th>
          <th>Source</th>
          <th>Granted</th>
        </tr>
      </thead>
      <tbody>
        {sorted.flatMap((g) => {
          const { service, entity } = parseCode(g.code)
          const group = `${service}.${entity}`
          const rows = []
          if (group !== lastGroup) {
            lastGroup = group
            rows.push(
              <tr key={`h-${group}-${g.id}`} className="group-row">
                <td colSpan={4}>{serviceLabel(service)} › {entityLabel(entity)}</td>
              </tr>
            )
          }
          rows.push(
            <tr key={g.id}>
              <td>
                <div>{actionLabel(g.code)} <span className="muted small">— {describe[g.code] || ''}</span></div>
                <div className="mono muted">{g.code}</div>
              </td>
              <td>
                {scopeLabel(g.scope_unit?.id, { ...unitsById, ...(g.scope_unit ? { [g.scope_unit.id]: g.scope_unit } : {}) }, g.self_only)}
                {g.valid_to && <div className="muted small">until {formatDateTime(g.valid_to)}</div>}
              </td>
              <td>{g.source_role ? <span className="chip subtle">{g.source_role} role</span> : 'Direct'}</td>
              <td className="muted small">
                {formatDateTime(g.granted_at)}
                {g.granted_by && <div>by {g.granted_by.name}</div>}
              </td>
            </tr>
          )
          return rows
        })}
      </tbody>
    </table>
  )
}

function ProfileForm({ orgId, user, units, managers, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    home_unit_id: user.home_unit?.id || null,
    manager_user_id: user.manager?.id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    // Send only what changed; null clears phone / manager.
    const body = {}
    if (form.name.trim() !== user.name) body.name = form.name.trim()
    if ((form.phone.trim() || null) !== (user.phone || null)) body.phone = form.phone.trim() || null
    if (form.home_unit_id && form.home_unit_id !== (user.home_unit?.id || null)) body.home_unit_id = form.home_unit_id
    if ((form.manager_user_id || null) !== (user.manager?.id || null)) body.manager_user_id = form.manager_user_id || null
    try {
      if (Object.keys(body).length) await usersApi.update(orgId, user.id, user.version, body)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="e-name">Full name</label>
          <input id="e-name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={255} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="e-phone">Phone</label>
          <input id="e-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98350 12345" />
          {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
        </div>
        <div className="field">
          <label htmlFor="e-unit">Works in</label>
          <UnitSelect id="e-unit" units={units} value={form.home_unit_id} emptyLabel="— Not placed yet —" onChange={(id) => set('home_unit_id', id)} />
          <div className="hint">Moving someone needs access where they move to as well.</div>
          {fieldErrors.home_unit_id && <div className="field-error">{fieldErrors.home_unit_id}</div>}
        </div>
        <div className="field">
          <label htmlFor="e-manager">Reports to</label>
          <select id="e-manager" value={form.manager_user_id} onChange={(e) => set('manager_user_id', e.target.value)}>
            <option value="">— No manager —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
            ))}
          </select>
          {fieldErrors.manager_user_id && <div className="field-error">{fieldErrors.manager_user_id}</div>}
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function DeactivateForm({ orgId, user, candidates, onCancel, onDone }) {
  const [reason, setReason] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await usersApi.deactivate(orgId, user.id, user.version, {
        reason: reason.trim(),
        reassign_to_user_id: reassignTo || null,
      })
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="danger-zone" onSubmit={submit}>
      <h3>Deactivate {user.name}?</h3>
      <p className="muted small">
        They are signed out everywhere and can no longer sign in. {user.status === 'invited' && 'Their invitation link stops working. '}
        Their history is kept.
      </p>
      {error && <div className="alert error">{friendlyMessage(error)}</div>}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="d-reason">Reason *</label>
          <input id="d-reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} placeholder="Left the company on 30 Sep" />
        </div>
        <div className="field">
          <label htmlFor="d-reassign">Hand their open work to</label>
          <select id="d-reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">— Back to the team queue —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn danger" type="submit" disabled={saving || !reason.trim()}>
          {saving ? 'Deactivating…' : 'Deactivate user'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function AccessForm({ orgId, user, grants, catalog, roles, units, onCancel, onSaved }) {
  const [value, setValue] = useState(() => accessFromGrants(grants))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await usersApi.replacePermissions(orgId, user.id, { ...toRequestAccess(value), reason: reason.trim() })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <ErrorBanner error={error} />}
      <AccessEditor catalog={catalog} roles={roles} units={units} value={value} onChange={setValue} fieldErrors={getFieldErrors(error)} />
      <div className="field" style={{ maxWidth: 520 }}>
        <label htmlFor="a-reason">Reason for the change *</label>
        <input id="a-reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} placeholder="Promoted to team lead" />
        <div className="hint">Recorded in the audit trail.</div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !reason.trim()}>{saving ? 'Saving…' : 'Save access'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
