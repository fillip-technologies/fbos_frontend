import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess, isClientAdmin } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// A person works in one place (a branch, department or team) and can also be an extra member
// of other teams. A team's panel lists both; any other unit lists who works in it or below it.
// The backend enforces who may change what; the checks here only hide actions that can't work.

// A refused change explains itself in a field error (e.g. "only teams take extra members");
// show that rather than the generic "some fields are invalid".
const inlineError = (err) => Object.values(getFieldErrors(err))[0] || friendlyMessage(err)

// How a listed person belongs to `unit`: 'works-here', 'team-member' or 'works-below'.
function belonging(person, unit) {
  if (person.home_unit?.id === unit.id) return 'works-here'
  if ((person.teams || []).some((t) => t.id === unit.id)) return 'team-member'
  return 'works-below'
}

function belongingLabel(person, unit) {
  const kind = belonging(person, unit)
  if (kind === 'works-here') return 'Works here'
  if (kind === 'works-below') return person.home_unit ? `Works in ${person.home_unit.name}` : 'Not placed anywhere'
  return person.home_unit ? `Team member · works in ${person.home_unit.name}` : 'Team member · not placed anywhere'
}

const peopleCount = (count) => `${count} ${count === 1 ? 'person' : 'people'}`

export default function UnitPeople({ orgId, unit, units, members, onChanged }) {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const canPlace = hasAccess(me, ACCESS.updateUsers)
  const canInvite = hasAccess(me, ACCESS.inviteUsers)
  const [action, setAction] = useState(null) // 'add' | { move: person } | { remove: person }
  const isTeam = unit.unit_type === 'team'

  // As on the user's own page: deactivated people can't be changed, and only a client admin
  // can change a client admin.
  const canChange = (person) =>
    canPlace && person.status !== 'deactivated' && (person.user_type !== 'client_admin' || isClientAdmin(me))

  const finish = (message) => {
    setAction(null)
    onChanged(message)
  }

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>People ({members.length}{members.length === 100 ? '+' : ''})</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {isTeam ? 'Who works in this team, and members who work elsewhere.' : 'Placed here or anywhere under it.'}
          </p>
        </div>
        {action === null && unit.status === 'active' && (canPlace || canInvite) && (
          <div className="row-actions">
            {canPlace && <button className="btn secondary" onClick={() => setAction('add')}>+ Add people</button>}
            {canInvite && (
              <button className="btn secondary" onClick={() => navigate(`/users/new?unit=${unit.id}`)}>+ Invite new person</button>
            )}
          </div>
        )}
      </div>

      {action === 'add' && (
        <AddPeopleForm
          orgId={orgId}
          unit={unit}
          me={me}
          onCancel={() => setAction(null)}
          onAdded={(count, allAdded) => {
            if (allAdded) setAction(null)
            onChanged(`Added ${peopleCount(count)} to ${unit.name}.`)
          }}
        />
      )}
      {action?.move && (
        <MovePersonForm
          orgId={orgId}
          person={action.move}
          units={units}
          onCancel={() => setAction(null)}
          onMoved={(to) => finish(`${action.move.name} moved to ${to.name}.`)}
        />
      )}
      {action?.remove && (
        <RemovePersonForm
          orgId={orgId}
          unit={unit}
          person={action.remove}
          onCancel={() => setAction(null)}
          onRemoved={() => finish(`${action.remove.name} removed from ${unit.name}.`)}
        />
      )}

      {members.length === 0 ? (
        <p className="muted">{isTeam ? 'Nobody is in this team yet.' : 'Nobody is placed here or under it.'}</p>
      ) : (
        <table className="compact">
          <tbody>
            {members.map((m) => {
              const kind = belonging(m, unit)
              return (
                <tr key={m.id} className="clickable" onClick={() => navigate(`/users/${m.id}`)}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td className="muted">{m.email}</td>
                  <td className="muted small">{belongingLabel(m, unit)}</td>
                  <td><StatusBadge status={m.status} /></td>
                  {canPlace && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {action === null && canChange(m) && (
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {kind !== 'team-member' && (
                            <button type="button" className="btn secondary small-btn" onClick={() => setAction({ move: m })}>
                              Move…
                            </button>
                          )}
                          {kind !== 'works-below' && (
                            <button type="button" className="btn danger-outline small-btn" onClick={() => setAction({ remove: m })}>
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Pick several people (search, tick, add). On a team they join as members and keep working where
// they are; anyone not placed anywhere yet is placed in the team. Anywhere else, adding someone
// places them here, which moves them out of where they work now.
function AddPeopleForm({ orgId, unit, me, onCancel, onAdded }) {
  const isTeam = unit.unit_type === 'team'
  const [q, setQ] = useState('')
  const [shownQuery, setShownQuery] = useState('')
  const [results, setResults] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [selected, setSelected] = useState([])
  const [failures, setFailures] = useState([])
  const [saving, setSaving] = useState(false)

  const search = useCallback(
    (term) => {
      setSearchError(null)
      usersApi
        .list(orgId, { q: term, limit: 25 })
        .then((res) => {
          setResults(res.data)
          setHasMore(Boolean(res.page?.has_more))
          setShownQuery(term)
        })
        .catch(setSearchError)
    },
    [orgId]
  )
  useEffect(() => search(''), [search])

  // Why a person can't be added here, or null when they can.
  function blocker(person) {
    if (person.home_unit?.id === unit.id) return 'Works here'
    if ((person.teams || []).some((t) => t.id === unit.id)) return 'Already a member'
    if (person.status === 'deactivated') return 'Deactivated'
    if (person.user_type === 'client_admin' && !isClientAdmin(me)) return 'Only a client admin can change them'
    return null
  }

  const isSelected = (person) => selected.some((s) => s.id === person.id)
  const toggle = (person) =>
    setSelected((current) =>
      current.some((s) => s.id === person.id) ? current.filter((s) => s.id !== person.id) : [...current, person]
    )

  const addOne = (person) =>
    isTeam && person.home_unit
      ? usersApi.joinTeam(orgId, person.id, unit.id)
      : usersApi.update(orgId, person.id, person.version, { home_unit_id: unit.id })

  async function submit() {
    setSaving(true)
    setFailures([])
    const failed = []
    // One at a time, so each refusal is reported against the person it concerns.
    for (const person of selected) {
      try {
        await addOne(person)
      } catch (err) {
        failed.push({ person, message: inlineError(err) })
      }
    }
    setSaving(false)
    setSelected(failed.map((f) => f.person))
    setFailures(failed)

    const addedCount = selected.length - failed.length
    if (addedCount === 0) return
    // The form stays open to show what failed; refresh the list so the added people show as added.
    if (failed.length) search(shownQuery)
    onAdded(addedCount, failed.length === 0)
  }

  return (
    <div className="inline-panel">
      <h3>Add people to {unit.name}</h3>
      <p className="muted small">
        {isTeam
          ? `They keep working where they are and join ${unit.name} as members. Anyone not placed anywhere yet will work in ${unit.name}.`
          : 'Each person works in one place, so this moves them here from where they work now.'}
      </p>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          search(q.trim())
        }}
      >
        <input placeholder="Search name, email or employee code" value={q} style={{ minWidth: 260 }} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" type="submit">Search</button>
      </form>
      <ErrorBanner error={searchError} />
      {results === null ? (
        !searchError && <p className="muted">Loading people…</p>
      ) : results.length === 0 ? (
        <p className="muted">{shownQuery ? `Nobody matches “${shownQuery}”.` : 'There is nobody to add yet.'}</p>
      ) : (
        <div className="perm-checks">
          {results.map((person) => {
            const reason = blocker(person)
            return (
              <label key={person.id} className="perm-check" style={reason ? { cursor: 'default', opacity: 0.6 } : undefined}>
                <input type="checkbox" checked={isSelected(person)} disabled={Boolean(reason) || saving} onChange={() => toggle(person)} />
                <span>
                  {person.name} <span className="muted small">{person.email}</span>
                  <div className="muted small">
                    {reason || (person.home_unit ? `Works in ${person.home_unit.name}` : 'Not placed anywhere yet')}
                  </div>
                </span>
              </label>
            )
          })}
        </div>
      )}
      {hasMore && <p className="muted small">Showing the first 25. Search to find someone else.</p>}

      {selected.length > 0 && (
        <div className="chips">
          {selected.map((person) => (
            <span key={person.id} className="chip subtle">
              {person.name}{' '}
              <button type="button" className="link-btn" aria-label={`Don't add ${person.name}`} disabled={saving} onClick={() => toggle(person)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {failures.length > 0 && (
        <div className="alert error">
          <div>{failures.length === 1 ? 'One person' : `${failures.length} people`} couldn't be added:</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {failures.map(({ person, message }) => (
              <li key={person.id}><strong>{person.name}</strong>: {message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row-actions">
        <button className="btn" type="button" disabled={saving || selected.length === 0} onClick={submit}>
          {saving ? 'Adding…' : selected.length > 1 ? `Add ${selected.length} people` : 'Add'}
        </button>
        <button className="btn secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function MovePersonForm({ orgId, person, units, onCancel, onMoved }) {
  const destinations = units.filter((u) => u.status === 'active' && u.id !== person.home_unit?.id)
  const [unitId, setUnitId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await usersApi.update(orgId, person.id, person.version, { home_unit_id: unitId })
      onMoved(units.find((u) => u.id === unitId))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={submit}>
      <h3>Move {person.name}</h3>
      <p className="muted small">
        {person.home_unit ? `Works in ${person.home_unit.name} now.` : 'Not placed anywhere yet.'} Their own access is not
        changed; people who manage the new place will be able to see and manage them.
      </p>
      {error && <div className="alert error">{inlineError(error)}</div>}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="mp-unit">Move to *</label>
          <UnitSelect id="mp-unit" units={destinations} value={unitId} emptyLabel="— Choose —" onChange={setUnitId} />
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !unitId}>{saving ? 'Moving…' : 'Move'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// A team member leaves the team. Someone who works here loses their place altogether, which the
// backend allows only to people who manage users across the whole company.
function RemovePersonForm({ orgId, unit, person, onCancel, onRemoved }) {
  const leavesTeam = belonging(person, unit) === 'team-member'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (leavesTeam) await usersApi.leaveTeam(orgId, person.id, unit.id)
      else await usersApi.update(orgId, person.id, person.version, { home_unit_id: null })
      onRemoved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="danger-zone" onSubmit={submit}>
      <h3>Remove {person.name} from {unit.name}?</h3>
      <p className="muted small">
        {leavesTeam
          ? `They stop being a member of this team${person.home_unit ? ` and keep working in ${person.home_unit.name}` : ''}.`
          : "They won't work anywhere until they're placed again. Only someone who manages people across the whole company can do this; to keep them placed, use Move instead."}
      </p>
      {error && <div className="alert error">{inlineError(error)}</div>}
      <div className="row-actions">
        <button className="btn danger" type="submit" disabled={saving}>{saving ? 'Removing…' : 'Remove'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
