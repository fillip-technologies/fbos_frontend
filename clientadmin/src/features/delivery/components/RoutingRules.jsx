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

  const list = rules ?? []
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Which team gets which work</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        When someone adds a task of a kind below, it goes to the team shown. A team that “takes requests” can also be asked for
        that work by people in other teams.
      </p>
      <ErrorBanner error={loadError || error} onRetry={reload} />

      {list.length === 0 ? (
        <p className="center-note">No rules yet: every task keeps the team it is given.</p>
      ) : (
        <ul className="rr-list">
          {list.map((rule) => (
            <li key={rule.id} className={`rr-rule${rule.active ? '' : ' is-off'}`}>
              <div className="rr-work">
                <strong>{workLabel(rule)}</strong>
                <span className="muted small">{rule.vertical ? `Only for ${names.verticalName(rule.vertical)}` : 'For every business line'}</span>
              </div>
              <span className="rr-arrow" aria-hidden="true">→</span>
              <div className="field rr-team">
                <label className="sr-only" htmlFor={`rr-team-${rule.id}`}>Team</label>
                <select id={`rr-team-${rule.id}`} value={rule.unit.id} disabled={busy === rule.id} onChange={(e) => update(rule, { unit_id: e.target.value })}>
                  {!units.some((u) => u.id === rule.unit.id) && <option value={rule.unit.id}>{names.unitName(rule.unit)}</option>}
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <label className="inline-check rr-ask">
                <input type="checkbox" checked={rule.accepts_requests} disabled={busy === rule.id} onChange={(e) => update(rule, { accepts_requests: e.target.checked })} />
                Other teams can ask for it
              </label>
              <span className="rr-state">
                <StatusBadge status={rule.active ? 'active' : 'inactive'} label={rule.active ? 'On' : 'Off'} />
                <button type="button" className="btn secondary small-btn" disabled={busy === rule.id} aria-busy={busy === rule.id} onClick={() => update(rule, { active: !rule.active })}>
                  {rule.active ? 'Turn off' : 'Turn on'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="rr-add" onSubmit={add}>
        <h3>Add a rule</h3>
        <div className="rr-add-grid">
          <div className="field">
            <label htmlFor="rr_work">When the work is</label>
            <select id="rr_work" required value={draft.work} onChange={(e) => setDraft((d) => ({ ...d, work: e.target.value }))}>
              <option value="">Choose the kind of work…</option>
              <optgroup label="Everything in a kind of work">
                {disciplines.map((d) => <option key={d} value={`discipline:${d}`}>All {disciplineLabel(d).toLowerCase()} work</option>)}
              </optgroup>
              <optgroup label="One task type only">
                {taskTypes.map((t) => <option key={t.code} value={`type:${t.code}`}>{t.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rr_team">Send it to team</label>
            <select id="rr_team" required value={draft.unit_id} onChange={(e) => setDraft((d) => ({ ...d, unit_id: e.target.value }))}>
              <option value="">Choose the team…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rr_line">Only for business line <span className="muted">(optional)</span></label>
            <select id="rr_line" value={draft.vertical_id} onChange={(e) => setDraft((d) => ({ ...d, vertical_id: e.target.value }))}>
              <option value="">Every business line</option>
              {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="rr-add-foot">
          <label className="inline-check">
            <input type="checkbox" checked={draft.accepts_requests} onChange={(e) => setDraft((d) => ({ ...d, accepts_requests: e.target.checked }))} />
            Other teams can ask this team for it
          </label>
          <button className="btn" type="submit" disabled={busy === 'new'} aria-busy={busy === 'new'}>Add rule</button>
        </div>
      </form>

      <details className="rr-help">
        <summary>What if two rules fit one task?</summary>
        <p className="muted small">The rule for one task type wins over the rule for its whole kind of work, and a rule for a business line wins over a rule for every business line.</p>
      </details>
    </div>
  )
}
