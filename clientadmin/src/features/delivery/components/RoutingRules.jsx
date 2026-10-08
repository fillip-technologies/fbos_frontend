import { useState } from 'react'
import { routingApi } from '@/features/delivery/api.js'
import { DISCIPLINE_ORDER, disciplineLabel } from '@/features/delivery/taskFields.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const BLANK = { work: '', vertical_id: '', unit_id: '', accepts_requests: false }

// Which team does which kind of work. Delivery decides with these rules (the console never
// works it out itself): the new-task form fills in the team from them, and requests go to the
// team a rule names when that rule takes requests.
export default function RoutingRules({ orgId, names, taskTypes }) {
  const { data: rules, error: loadError, reload } = useLookup(
    ['routing-rules', orgId],
    ({ signal }) => routingApi.rules(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [draft, setDraft] = useState(BLANK)
  const [busy, setBusy] = useState(null) // a rule id, or 'new'
  const [error, setError] = useState(null)

  const units = (names.units || []).filter((u) => u.status !== 'inactive')
  const verticals = names.verticals || []
  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...taskTypes.map((t) => t.discipline)])].filter((d) => taskTypes.some((t) => t.discipline === d))
  const typeName = (code) => taskTypes.find((t) => t.code === code)?.name || code
  const workLabel = (rule) => (rule.task_type_code ? typeName(rule.task_type_code) : `All ${disciplineLabel(rule.discipline).toLowerCase()} work`)

  function changed() {
    // Where work goes has changed: the forms ask again.
    invalidate(['routing-rules', orgId])
    invalidate(['task-routing', orgId])
    invalidate(['requestable-types', orgId])
  }

  async function save(key, write) {
    setBusy(key)
    setError(null)
    try {
      await write()
      changed()
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
    const [kind, value] = draft.work.split(':')
    const body = { unit_id: draft.unit_id, accepts_requests: draft.accepts_requests }
    body[kind === 'type' ? 'task_type_code' : 'discipline'] = value
    if (draft.vertical_id) body.vertical_id = draft.vertical_id
    if (await save('new', () => routingApi.createRule(orgId, body))) setDraft(BLANK)
  }

  const update = (rule, body) => save(rule.id, () => routingApi.updateRule(orgId, rule, body))

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Which team does which work</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        A new task’s team is filled in from these rules, and people can ask a team for the work its rules take
        requests for. When several rules fit, the one for the task type beats the one for its discipline, and the one
        for a business line beats the one for any business line.
      </p>
      <ErrorBanner error={loadError || error} onRetry={reload} />

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Work</th>
              <th>Business line</th>
              <th>Team</th>
              <th>Takes requests</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).length === 0 ? (
              <tr><td colSpan={5} className="center-note">No rules yet: every task keeps the team it is given.</td></tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className={rule.active ? undefined : 'muted'}>
                  <td>{workLabel(rule)}</td>
                  <td>{rule.vertical ? names.verticalName(rule.vertical) : 'Any'}</td>
                  <td>
                    <select
                      aria-label="Team"
                      value={rule.unit.id}
                      disabled={busy === rule.id}
                      onChange={(e) => update(rule, { unit_id: e.target.value })}
                    >
                      {!units.some((u) => u.id === rule.unit.id) && <option value={rule.unit.id}>{names.unitName(rule.unit)}</option>}
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Takes requests"
                      checked={rule.accepts_requests}
                      disabled={busy === rule.id}
                      onChange={(e) => update(rule, { accepts_requests: e.target.checked })}
                    />
                  </td>
                  <td>
                    <span className="row-actions">
                      <StatusBadge status={rule.active ? 'active' : 'inactive'} label={rule.active ? 'On' : 'Off'} />
                      <button
                        type="button"
                        className="btn secondary small-btn"
                        disabled={busy === rule.id}
                        aria-busy={busy === rule.id}
                        onClick={() => update(rule, { active: !rule.active })}
                      >
                        {rule.active ? 'Turn off' : 'Turn on'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form className="toolbar" style={{ marginTop: 14 }} onSubmit={add}>
        <select aria-label="Work" required value={draft.work} onChange={(e) => setDraft((d) => ({ ...d, work: e.target.value }))}>
          <option value="">— Kind of work —</option>
          <optgroup label="A whole discipline">
            {disciplines.map((d) => <option key={d} value={`discipline:${d}`}>All {disciplineLabel(d).toLowerCase()} work</option>)}
          </optgroup>
          <optgroup label="One task type">
            {taskTypes.map((t) => <option key={t.code} value={`type:${t.code}`}>{t.name}</option>)}
          </optgroup>
        </select>
        <select aria-label="Business line" value={draft.vertical_id} onChange={(e) => setDraft((d) => ({ ...d, vertical_id: e.target.value }))}>
          <option value="">Any business line</option>
          {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select aria-label="Team" required value={draft.unit_id} onChange={(e) => setDraft((d) => ({ ...d, unit_id: e.target.value }))}>
          <option value="">— Goes to team —</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={draft.accepts_requests}
            onChange={(e) => setDraft((d) => ({ ...d, accepts_requests: e.target.checked }))}
          />
          Takes requests
        </label>
        <button className="btn" type="submit" disabled={busy === 'new'} aria-busy={busy === 'new'}>Add rule</button>
      </form>
    </div>
  )
}
