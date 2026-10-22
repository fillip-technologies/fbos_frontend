import { useState } from 'react'
import { setupApi } from '@/features/delivery/api.js'
import useAssignmentPolicies, { ASSIGNMENT_POLICY_LABELS } from '@/features/delivery/useAssignmentPolicies.js'
import { invalidate } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const BLANK = { unit_id: '', policy: 'round_robin' }

// How each team hands out the work that reaches it without an assignee. Listed: the teams that
// give it out by themselves; every other team leaves it in its queue.
export default function AssignmentPolicies({ orgId, names }) {
  const { rows, rowOf, error: loadError, reload } = useAssignmentPolicies(orgId)
  const [draft, setDraft] = useState(BLANK)
  const [busy, setBusy] = useState(null) // a unit id, or 'new'
  const [error, setError] = useState(null)

  const units = (names.units || []).filter((u) => u.status !== 'inactive')
  const givingOut = rows.filter((p) => p.policy !== 'queue')
  const choosable = units.filter((u) => !givingOut.some((p) => p.unit.id === u.id))

  async function choose(key, unitId, policy) {
    setBusy(key)
    setError(null)
    try {
      await setupApi.setAssignmentPolicy(orgId, unitId, rowOf(unitId)?.version ?? 0, policy)
      invalidate(['assignment-policies', orgId])
      return true
    } catch (err) {
      setError(err)
      return false
    } finally {
      setBusy(null)
    }
  }

  async function add(e) {
    e.preventDefault()
    if (await choose('new', draft.unit_id, draft.policy)) setDraft(BLANK)
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>How teams hand out new work</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Work that reaches a team without an assignee (a task left for the team, a request, a handed-over task, a
        follow-up whose person has left) waits in the team’s queue until someone takes it. A team can give it out
        instead: its people take turns, or whoever has the fewest open tasks gets it. Everyone who belongs to the
        team takes part, including people in the units below it, and someone away still gets their turn. Units below
        keep their own setting.
      </p>
      <ErrorBanner error={loadError || error} onRetry={reload} />

      {givingOut.length > 0 && (
        <table style={{ marginBottom: 14 }}>
          <thead>
            <tr>
              <th>Team</th>
              <th>New work</th>
            </tr>
          </thead>
          <tbody>
            {givingOut.map((p) => (
              <tr key={p.unit.id}>
                <td>{names.unitName(p.unit)}</td>
                <td>
                  <select
                    aria-label={`How ${names.unitName(p.unit)} hands out new work`}
                    value={p.policy}
                    disabled={busy === p.unit.id}
                    aria-busy={busy === p.unit.id}
                    onChange={(e) => choose(p.unit.id, p.unit.id, e.target.value)}
                  >
                    {Object.entries(ASSIGNMENT_POLICY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="toolbar" onSubmit={add}>
        <select aria-label="Team" required value={draft.unit_id} onChange={(e) => setDraft((d) => ({ ...d, unit_id: e.target.value }))}>
          <option value="">— Team —</option>
          {choosable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="How it hands out new work" value={draft.policy} onChange={(e) => setDraft((d) => ({ ...d, policy: e.target.value }))}>
          <option value="round_robin">{ASSIGNMENT_POLICY_LABELS.round_robin}</option>
          <option value="least_busy">{ASSIGNMENT_POLICY_LABELS.least_busy}</option>
        </select>
        <button className="btn" type="submit" disabled={busy === 'new'} aria-busy={busy === 'new'}>Save</button>
      </form>
    </div>
  )
}
