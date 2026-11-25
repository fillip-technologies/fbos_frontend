import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ceoApi } from '@/features/ceo/api.js'
import { Stat } from '@/features/ceo/components/Parts.jsx'
import { count, num } from '@/features/ceo/utils.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { useQuery } from '@/shared/api/useQuery.js'
import { BarList, ChartCard, SERIES, STATUS } from '@/shared/components/Charts.jsx'

// Same weeks as the Dashboard's, so a company already opened there is answered from the cache.
const WEEKS = 25
const STAGES = ['todo', 'in_progress', 'in_review', 'blocked']
const openOf = (row) => STAGES.reduce((sum, k) => sum + num(row[k]), 0)

// Who is doing what, for the CEO: how loaded each team is, and the few people whose work is late.
// It reads the task summary the Dashboard reads (delivery.task.read) and names people and teams
// from the console's lookups (a person without identity.user.read sees numbered people).
export default function TeamPulse({ orgId, workforce }) {
  const { user } = useAuth()
  const names = useDeliveryNames(orgId)
  const enabled = Boolean(orgId) && hasAccess(user, ACCESS.tasks)
  const tasks = useQuery(['overview', orgId, 'tasks', WEEKS], (o) => ceoApi.tasks(orgId, WEEKS, o), { enabled, keepPrevious: true })
  if (!enabled) return null

  const data = tasks.data
  const today = workforce.data?.attendance_today
  const present = today?.by_status?.find((b) => b.key === 'present')?.count

  const teams = (data?.units ?? [])
    .map((u) => ({ id: u.unit_id, open: openOf(u), late: num(u.overdue) }))
    .filter((u) => u.open > 0)
    .sort((a, b) => b.late - a.late || b.open - a.open)
    .slice(0, 8)
  const unitLabel = (id) => (id ? names.unitName(id) : 'No team')

  const people = (data?.people ?? []).filter((p) => p.user_id)
  const support = people
    .map((p) => ({ id: p.user_id, open: openOf(p), late: num(p.overdue) }))
    .filter((p) => p.late > 0)
    .sort((a, b) => b.late - a.late || b.open - a.open)
    .slice(0, 5)
  const named = (id, i) => {
    const name = names.personName(id)
    return name && name !== '—' ? name : `Person ${i + 1}`
  }
  const hidden = support.some((p) => names.personName(p.id) === '—')
  const maxOpen = Math.max(1, ...support.map((p) => p.open))

  const empty = (text) => (tasks.loading && !data ? <p className="chart-empty">Loading…</p> : tasks.error && !data ? <p className="chart-empty">Can’t load right now. Try Refresh in a moment.</p> : <p className="chart-empty">{text}</p>)

  return (
    <div className="cc-row cols-2">
      <ChartCard title="Team workload" subtitle="Open tasks by team, busiest and latest first"
        action={<Link className="link-btn" to="/insights">Insights</Link>}
        table={data ? { columns: ['Team', 'Open', 'Late'], rows: teams.map((t) => [unitLabel(t.id), count(t.open), count(t.late)]) } : undefined}>
        {!data ? (
          empty('No tasks yet.')
        ) : (
          <>
            <div className="cc-stats four">
              <Stat label="Open tasks" value={count(data.open)} />
              <Stat label="Late" value={count(data.overdue)} tone={data.overdue > 0 ? 'bad' : 'good'} />
              <Stat label="Unassigned" value={count(data.unassigned)} tone={data.unassigned > 0 ? 'warn' : ''} />
              {today && present !== undefined && <Stat label="In today" value={`${count(present)} / ${count(today.expected)}`} />}
            </div>
            <BarList format={count} color={SERIES[0]} emptyText="No open tasks."
              rows={teams.map((t) => ({ key: t.id ?? 'none', label: unitLabel(t.id), value: t.open, sub: t.late ? `${count(t.late)} late` : undefined, tipLabel: 'Open tasks' }))} />
          </>
        )}
      </ChartCard>

      <ChartCard title="Who needs support" subtitle="People with late tasks: the most late first"
        action={<Link className="link-btn" to="/tasks?view=team">Tasks</Link>}
        table={data ? { columns: ['Person', 'Open', 'Late'], rows: support.map((p, i) => [named(p.id, i), count(p.open), count(p.late)]) } : undefined}>
        {!data ? (
          empty('No tasks yet.')
        ) : support.length === 0 ? (
          <p className="chart-empty">No one has late tasks.</p>
        ) : (
          <>
            <ul className="cc-support">
              {support.map((p, i) => (
                <li key={p.id}>
                  <span className="mini-avatar">{named(p.id, i)[0]}</span>
                  <span className="cc-support-main">
                    <Link to={`/users/${p.id}`}>{named(p.id, i)}</Link>
                    <span className="cc-support-bar" aria-hidden="true"><span style={{ width: `${(p.open / maxOpen) * 100}%` }} /></span>
                  </span>
                  <span className="cc-support-nums">
                    <span className="flag bad" style={{ color: STATUS.critical }}>▲ {count(p.late)} late</span>
                    <small>{count(p.open)} open</small>
                  </span>
                </li>
              ))}
            </ul>
            {hidden && <p className="cc-note-line">Names show for people who may see the user list.</p>}
            <p className="cc-note-line">Late work is a sign someone needs help, not a ranking.</p>
          </>
        )}
      </ChartCard>
    </div>
  )
}
