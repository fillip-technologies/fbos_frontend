import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { calendarsApi } from '@/features/calendars/api.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { usersApi } from '@/features/users/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import UnitVerticals from '@/features/org-units/components/UnitVerticals.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { breadcrumb, childTypesFor, isTopLevelType, parentCandidates, sortedTree, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'
import { formatDateTime } from '@/features/users/utils.js'

function Detail({ label, children }) {
  return (
    <div className="detail">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function OrgUnitDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canUpdate = hasAccess(me, ACCESS.updateOrgUnit)
  const canMove = hasAccess(me, ACCESS.moveOrgUnit)
  const canCreate = hasAccess(me, ACCESS.createOrgUnit)

  const [unit, setUnit] = useState(null)
  const [units, setUnits] = useState([])
  const [people, setPeople] = useState(null) // active users of the org, for the head picker
  const [calendars, setCalendars] = useState(null) // null when the user can't read calendars
  const [members, setMembers] = useState(null) // users placed in this unit or any unit below it
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [mode, setMode] = useState(null) // 'edit' | 'move' | 'status'

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    Promise.all([
      orgUnitsApi.get(orgId, id),
      orgUnitsApi.listAll(orgId),
      usersApi.list(orgId, { limit: 100, status: 'active' }).then((r) => r.data).catch(() => null),
      usersApi.list(orgId, { limit: 100, unit_id: id }).then((r) => r.data).catch(() => null),
      calendarsApi.list(orgId).catch(() => null),
    ])
      .then(([u, all, p, m, c]) => {
        setUnit(u)
        setUnits(sortedTree(all))
        setPeople(p)
        setMembers(m)
        setCalendars(c)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

  // Clear a stale notice when switching to another unit.
  useEffect(() => setNotice(location.state?.notice || ''), [id, location.state])

  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])

  const done = (message) => {
    setMode(null)
    setNotice(message)
    load()
  }

  if (loading && !unit) return <div className="center-note">Loading…</div>
  if (!unit)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <Link className="btn secondary" to="/org-units">← Back to company structure</Link>
      </div>
    )

  const ancestors = breadcrumb(unit, unitsById)
  const children = units.filter((u) => u.parent_id === unit.id)
  const activeChildren = children.filter((u) => u.status === 'active')
  const isActive = unit.status === 'active'
  const childTypes = isActive ? childTypesFor(unit.unit_type) : []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {unit.name} <StatusBadge status={unit.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type} · <span className="mono">{unit.code}</span>
            {ancestors.length > 0 && (
              <>
                {' · '}
                {ancestors.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ' › '}
                    <Link to={`/org-units/${a.id}`}>{a.name}</Link>
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
        <Link className="btn secondary" to="/org-units">← Back</Link>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {mode === null && <ErrorBanner error={error} />}

      {/* ---------------- Details ---------------- */}
      <div className="panel form-section">
        <div className="section-head">
          <h2>Details</h2>
          {mode === null && (
            <div className="row-actions">
              {canUpdate && isActive && <button className="btn secondary" onClick={() => setMode('edit')}>Edit</button>}
              {canMove && isActive && !isTopLevelType(unit.unit_type) && (
                <button className="btn secondary" onClick={() => setMode('move')}>Move…</button>
              )}
              {canUpdate && (
                <button className={isActive ? 'btn danger-outline' : 'btn secondary'} onClick={() => setMode('status')}>
                  {isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          )}
        </div>

        {mode === 'edit' ? (
          <EditForm orgId={orgId} unit={unit} people={people} calendars={calendars} onCancel={() => setMode(null)} onSaved={() => done('Saved.')} />
        ) : (
          <div className="details-grid">
            <Detail label="Name">{unit.name}</Detail>
            <Detail label="Code"><span className="mono">{unit.code}</span></Detail>
            <Detail label="Type">{UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type}</Detail>
            <Detail label="Sits under">
              {unit.parent_id
                ? (unitsById[unit.parent_id] ? <Link to={`/org-units/${unit.parent_id}`}>{unitsById[unit.parent_id].name}</Link> : 'Unknown place')
                : <span className="muted">Directly under the company</span>}
            </Detail>
            <Detail label="Head">{unit.head_user && <Link to={`/users/${unit.head_user.id}`}>{unit.head_user.name}</Link>}</Detail>
            <Detail label="Working calendar">
              {unit.calendar_id &&
                (calendars?.find((c) => c.id === unit.calendar_id) ? (
                  <Link to="/calendars">{calendars.find((c) => c.id === unit.calendar_id).name}</Link>
                ) : (
                  'Assigned'
                ))}
              {unit.calendar_id && unit.calendar_id === activeOrg?.calendar_id && (
                <span className="muted small"> · the company calendar</span>
              )}
            </Detail>
            <Detail label="Created">{formatDateTime(unit.created_at)}</Detail>
            <Detail label="Last changed">{formatDateTime(unit.updated_at)}</Detail>
          </div>
        )}

        {mode === 'move' && (
          <MoveForm orgId={orgId} unit={unit} units={units} onCancel={() => setMode(null)} onMoved={(to) => done(`Moved under ${to.name}.`)} />
        )}
        {mode === 'status' && (
          <StatusForm
            orgId={orgId}
            unit={unit}
            activeChildren={activeChildren}
            directMemberCount={members?.filter((m) => m.home_unit?.id === unit.id).length}
            onCancel={() => setMode(null)}
            onDone={(u) => done(u.status === 'active' ? 'Reactivated.' : 'Deactivated.')}
          />
        )}
      </div>

      {/* ---------------- Verticals ---------------- */}
      <UnitVerticals key={unit.id} orgId={orgId} unit={unit} canUpdate={canUpdate} onChanged={load} />

      {/* ---------------- Sub-units ---------------- */}
      <div className="panel form-section">
        <div className="section-head">
          <h2>Under {unit.name} ({children.length})</h2>
          {canCreate && childTypes.length > 0 && (
            <button className="btn secondary" onClick={() => navigate(`/org-units/new?parent=${unit.id}`)}>+ Add under {unit.name}</button>
          )}
        </div>
        {children.length === 0 ? (
          <p className="muted">
            {childTypes.length
              ? `Nothing here yet. A ${UNIT_TYPE_LABELS[unit.unit_type].toLowerCase()} can contain: ${childTypes.map((t) => UNIT_TYPE_LABELS[t].toLowerCase()).join(', ')}.`
              : 'Teams are the lowest level; nothing sits under a team.'}
          </p>
        ) : (
          <table className="compact">
            <tbody>
              {children
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/org-units/${c.id}`)}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="mono">{c.code}</td>
                    <td>{UNIT_TYPE_LABELS[c.unit_type]}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------- People ---------------- */}
      {members && (
        <div className="panel form-section">
          <div className="section-head">
            <div>
              <h2>People ({members.length}{members.length === 100 ? '+' : ''})</h2>
              <p className="muted small" style={{ margin: '2px 0 0' }}>Placed here or anywhere under it.</p>
            </div>
          </div>
          {members.length === 0 ? (
            <p className="muted">Nobody is placed here or under it.</p>
          ) : (
            <table className="compact">
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="clickable" onClick={() => navigate(`/users/${m.id}`)}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td className="muted">{m.email}</td>
                    <td>{m.home_unit && m.home_unit.id !== unit.id ? <span className="muted small">in {m.home_unit.name}</span> : null}</td>
                    <td><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function EditForm({ orgId, unit, people, calendars, onCancel, onSaved }) {
  const [name, setName] = useState(unit.name)
  const [headId, setHeadId] = useState(unit.head_user?.id || '')
  const [calendarId, setCalendarId] = useState(unit.calendar_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  // The current head may not be in the active-users list (e.g. since deactivated).
  const headOptions = people && unit.head_user && !people.some((p) => p.id === unit.head_user.id) ? [unit.head_user, ...people] : people

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const body = {}
    if (name.trim() !== unit.name) body.name = name.trim()
    if (headId && headId !== (unit.head_user?.id || '')) body.head_user_id = headId
    if (calendarId && calendarId !== (unit.calendar_id || '')) body.calendar_id = calendarId
    try {
      if (Object.keys(body).length) await orgUnitsApi.update(orgId, unit.id, unit.version, body)
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
          <label htmlFor="ue-name">Name</label>
          <input id="ue-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        {headOptions && (
          <div className="field">
            <label htmlFor="ue-head">Head</label>
            <select id="ue-head" value={headId} onChange={(e) => setHeadId(e.target.value)}>
              {/* The backend can replace a head but not remove one, so "none" is offered only while there is none. */}
              {!unit.head_user && <option value="">— None —</option>}
              {headOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
              ))}
            </select>
            {unit.head_user && <div className="hint">A head can be replaced but not removed.</div>}
            {fieldErrors.head_user_id && <div className="field-error">{fieldErrors.head_user_id}</div>}
          </div>
        )}
        {calendars && (
          <div className="field">
            <label htmlFor="ue-cal">Working calendar</label>
            <select id="ue-cal" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {/* Like the head, a calendar can be replaced but not removed. */}
              {!unit.calendar_id && <option value="">— None —</option>}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.timezone})</option>
              ))}
            </select>
            <div className="hint">Changing it here doesn't change what already sits under it.</div>
            {fieldErrors.calendar_id && <div className="field-error">{fieldErrors.calendar_id}</div>}
          </div>
        )}
      </div>
      <p className="muted small">The code and type are fixed. To change where it sits, use Move.</p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function MoveForm({ orgId, unit, units, onCancel, onMoved }) {
  const candidates = parentCandidates(units, unit.unit_type, unit).filter((u) => u.id !== unit.parent_id)
  const [parentId, setParentId] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await orgUnitsApi.move(orgId, unit.id, unit.version, { new_parent_id: parentId, reason: reason.trim() })
      onMoved(units.find((u) => u.id === parentId))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={submit}>
      <h3>Move {unit.name}</h3>
      <p className="muted small">
        Everything below it moves too. Access granted on this unit or below keeps applying to the same units.
      </p>
      {error && <div className="alert error">{friendlyMessage(error)}</div>}
      {candidates.length === 0 ? (
        <p className="muted">There is nowhere else a {UNIT_TYPE_LABELS[unit.unit_type].toLowerCase()} can be moved under.</p>
      ) : (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="um-parent">New parent *</label>
            <UnitSelect id="um-parent" units={candidates} value={parentId} emptyLabel="— Choose —" onChange={setParentId} />
          </div>
          <div className="field">
            <label htmlFor="um-reason">Reason *</label>
            <input id="um-reason" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Restructure after merger" />
            <div className="hint">Recorded in the audit trail.</div>
          </div>
        </div>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !parentId || !reason.trim()}>{saving ? 'Moving…' : 'Move'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function StatusForm({ orgId, unit, activeChildren, directMemberCount, onCancel, onDone }) {
  const deactivating = unit.status === 'active'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onDone(await orgUnitsApi.update(orgId, unit.id, unit.version, { status: deactivating ? 'inactive' : 'active' }))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={deactivating ? 'danger-zone' : 'inline-panel'} onSubmit={submit}>
      <h3>{deactivating ? `Deactivate ${unit.name}?` : `Reactivate ${unit.name}?`}</h3>
      {deactivating ? (
        <>
          <p className="muted small">
            It disappears from pickers, so nobody new can be placed in it. Existing people and access are not changed.
          </p>
          {(activeChildren.length > 0 || directMemberCount > 0) && (
            <div className="alert warn">
              {activeChildren.length > 0 && <div>{activeChildren.length} active {activeChildren.length === 1 ? 'place sits under it and stays' : 'places sit under it and stay'} active.</div>}
              {directMemberCount > 0 && <div>{directMemberCount} {directMemberCount === 1 ? 'person is' : 'people are'} placed in it.</div>}
              <div>Consider moving them first.</div>
            </div>
          )}
        </>
      ) : (
        <p className="muted small">It can be picked again when placing people.</p>
      )}
      {error && <div className="alert error">{friendlyMessage(error)}</div>}
      <div className="row-actions">
        <button className={deactivating ? 'btn danger' : 'btn'} type="submit" disabled={saving}>
          {saving ? 'Saving…' : deactivating ? 'Deactivate' : 'Reactivate'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
