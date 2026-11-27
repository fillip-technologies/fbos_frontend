import { Link } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import { useQuery } from '@/shared/api/useQuery.js'

// Same weeks as the Dashboard's, so a company already opened there is answered from the cache.
const WEEKS = 25
const STAGES = [
  { key: 'todo', label: 'To do', color: '#9cc3f2' },
  { key: 'in_progress', label: 'In progress', color: '#2a78d6' },
  { key: 'in_review', label: 'In review', color: '#eda100' },
  { key: 'blocked', label: 'Blocked', color: '#d03b3b' },
]
const num = (v) => Number(v) || 0
const openOf = (row) => STAGES.reduce((sum, s) => sum + num(row[s.key]), 0)

// The top of "All tasks": the company's numbers, then how much work each person has, split by stage,
// so an admin sees who is loaded or stuck before reading the list. Reads the task summary the
// Dashboard reads; people are named from the console's lookups.
export default function TeamOverview({ orgId, names, unitId = '' }) {
  // A department's numbers are their own cache entry; the company's key is the Dashboard's.
  const key = unitId ? ['overview', orgId, 'tasks', WEEKS, unitId] : ['overview', orgId, 'tasks', WEEKS]
  const { data } = useQuery(key, ({ signal }) => tasksApi.stats(orgId, WEEKS, { signal, unitId }), {
    enabled: Boolean(orgId),
    keepPrevious: true,
  })
  if (!data) return null

  const tiles = [
    { label: 'Open tasks', value: num(data.open), tone: '' },
    { label: 'Overdue', value: num(data.overdue), tone: num(data.overdue) > 0 ? 'bad' : '' },
    { label: 'Not given to anyone', value: num(data.unassigned), tone: num(data.unassigned) > 0 ? 'warn' : '' },
    ...(data.done_recent !== undefined ? [{ label: 'Done in 30 days', value: num(data.done_recent), tone: '' }] : []),
  ]
  const people = (data.people ?? [])
    .filter((p) => p.user_id && openOf(p) > 0)
    .sort((a, b) => num(b.overdue) - num(a.overdue) || openOf(b) - openOf(a))
    .slice(0, 8)
  const widest = Math.max(1, ...people.map(openOf))
  const label = (id, i) => {
    const name = names.personName(id)
    return name && name !== '—' ? name : `Person ${i + 1}`
  }

  return (
    <section className="tov" aria-label="Everyone's tasks at a glance">
      <div className="task-strip">
        {tiles.map((t) => (
          <div key={t.label} className={`task-strip-item ${t.tone}`}>
            <span className="task-strip-label">{t.label}</span>
            <strong>{t.value}</strong>
          </div>
        ))}
      </div>
      {people.length > 0 && (
        <div className="tov-card">
          <div className="tov-head">
            <h2>Who has how much</h2>
            <ul className="tov-legend" aria-label="Stages">
              {STAGES.map((s) => (
                <li key={s.key}><i style={{ background: s.color }} />{s.label}</li>
              ))}
            </ul>
          </div>
          <ul className="tov-rows">
            {people.map((p, i) => (
              <li key={p.user_id}>
                <span className="mini-avatar">{label(p.user_id, i)[0]}</span>
                <Link className="tov-name" to={`/users/${p.user_id}`}>{label(p.user_id, i)}</Link>
                <span className="tov-bar" style={{ width: `${(openOf(p) / widest) * 100}%` }} title={`${openOf(p)} open`}>
                  {STAGES.map((s) => num(p[s.key]) > 0 && (
                    <span key={s.key} style={{ flex: num(p[s.key]), background: s.color }} title={`${s.label}: ${num(p[s.key])}`} />
                  ))}
                </span>
                <span className="tov-nums">
                  <strong>{openOf(p)}</strong> open
                  {num(p.overdue) > 0 && <em> · {num(p.overdue)} late</em>}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted small tov-note">Late work means someone may need help. It is not a ranking.</p>
        </div>
      )}
    </section>
  )
}
