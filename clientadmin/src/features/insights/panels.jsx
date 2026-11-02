import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import {
  BudgetBar,
  count,
  hours,
  KpiChip,
  pct,
  ProgressBar,
  RAG,
  Scoreboard,
  Stat,
  WORK_STAGES,
  WorkBar,
} from '@/features/insights/components.jsx'
import { add, avgProgress, budgetUse, kpiRag, kpiScore, RANGES, sumWithin, unitTree, useInsightQueries } from '@/features/insights/data.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { ChartCard, ColumnChart, LineChart, SegmentedBar, SERIES, StackedRows } from '@/shared/components/Charts.jsx'
import { Row } from '@/shared/components/DashboardGrid.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The insight panels on a unit's, a person's and a project's own page. Each reads the same
// summaries as the Insights page, narrowed to that one record, and shows only what the user may read.

const dayShort = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const weekCats = (weeks) =>
  weeks.map((w) => {
    const d = new Date(`${w.week_start}T00:00:00`)
    return { key: w.week_start, label: dayShort.format(d), title: `Week of ${dayShort.format(d)}` }
  })
const UNIT_CHILD = { branch: 'Departments', department: 'Teams', team: 'Sub-teams' }

function PanelHead({ title, sub, range, setRange }) {
  return (
    <div className="ins-panel-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      <div className="segmented" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.key} type="button" className={range === r.key ? 'active' : ''} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Names for a list of people, numbered the same way wherever the list is drawn ("Person 1"
// for someone the user may not look up).
function labeler(names, ids) {
  const labels = new Map()
  let unnamed = 0
  for (const id of ids) {
    if (!id || labels.has(id)) continue
    const name = names.personName(id)
    labels.set(id, name && name !== '—' ? name : `Person ${++unnamed}`)
  }
  return (id) => (id ? labels.get(id) ?? 'Someone' : 'Unassigned')
}

function firstError(...queries) {
  return queries.find((x) => x?.error && !x?.data)
}

function workParts(work, doneLabel) {
  const parts = WORK_STAGES.map((s) => ({ label: s.label, value: work?.[s.key] ?? 0, color: s.color, ink: s.key === 'blocked' ? '#0b0b0b' : '#fff' }))
  if (doneLabel) parts.push({ label: doneLabel, value: work?.done_recent ?? 0, color: '#94a3b8' })
  return parts
}

// ---------- A branch, department or team (with everything under it) ----------
export function UnitInsights({ unitId }) {
  const { orgId } = useActiveOrg()
  const [range, setRange] = useState('quarter')
  const all = useInsightQueries(orgId, { range })
  const own = useInsightQueries(orgId, {
    range,
    tasks: { owning_unit_id: unitId },
    need: { units: false, projects: false, time: false, budgets: false, workforce: false, kpis: false },
  })
  const names = useDeliveryNames(orgId)
  const tree = useMemo(() => unitTree(all.units.data ?? []), [all.units.data])
  const unit = tree.byId.get(unitId)
  const ids = useMemo(() => tree.subtree(unitId), [tree, unitId])
  if (!unit && !all.units.loading) return null

  const kpiResults = all.kpis.data?.results ?? []
  const sums = (inIds) => ({
    work: all.tasks.data ? sumWithin(all.tasks.data.units, (r) => r.unit_id, inIds, add.work) : null,
    projects: all.projects.data ? sumWithin(all.projects.data.units, (r) => r.unit_id, inIds, add.projects) : null,
    budget: all.budgets.data ? sumWithin(all.budgets.data.budgets, (b) => b.scope_unit_id, inIds, add.budget) : null,
    time: all.time.data ? sumWithin(all.time.data.by_unit, (r) => r.unit_id, inIds, add.time) : null,
    people: all.workforce.data ? sumWithin(all.workforce.data.by_unit, (r) => r.unit_id, inIds, add.people) : null,
    kpi: all.kpis.data ? sumWithin(kpiResults.filter((r) => r.scope?.unit_id), (r) => r.scope.unit_id, inIds, add.kpi) : null,
  })
  const total = sums(ids)
  const children = tree.children.get(unitId) ?? []
  const childRows = children.map((c) => ({ key: c.id, id: c.id, label: c.name, link: `/org-units/${c.id}`, ...sums(tree.subtree(c.id)) }))
  const people = (own.tasks.data?.people ?? []).slice(0, 10)
  const projects = (all.projects.data?.running_projects ?? []).filter((p) => ids.has(p.owning_unit_id))
  const budgets = (all.budgets.data?.budgets ?? []).filter((b) => ids.has(b.scope_unit_id))
  const kpis = kpiResults.filter((r) => ids.has(r.scope?.unit_id))
  const cur = all.budgets.data?.currency || 'INR'
  const error = firstError(all.tasks, all.projects, all.time, all.budgets, all.workforce, all.kpis)
  const maxOpen = Math.max(1, ...childRows.map((r) => r.work?.open ?? 0))
  const personLabel = labeler(names, people.map((p) => p.user_id))

  return (
    <section className="ins-panel" aria-label="Insights">
      <PanelHead
        title="How this unit is doing"
        sub={`${unit?.name ?? ''}${children.length ? ` and the ${children.length} unit${children.length === 1 ? '' : 's'} under it` : ''} · work, projects, budget, KPIs and hours`}
        range={range}
        setRange={setRange}
      />
      {error && <ErrorBanner error={error.error} onRetry={error.reload} />}
      <div className="ins-stats">
        {total.people !== null && <Stat label="People" value={count(total.people)} />}
        {total.work && <Stat label="Open work" value={count(total.work.open)} sub={total.work.overdue ? `${count(total.work.overdue)} late` : 'Nothing late'} tone={total.work.overdue ? 'bad' : 'good'} />}
        {total.work && <Stat label={`Done · last ${all.range.days} days`} value={count(total.work.done_recent)} />}
        {total.projects && <Stat label="Project completion" value={pct(avgProgress(total.projects))} sub={`${count(total.projects.running)} running · ${count(total.projects.late)} late`} tone={total.projects.late ? 'bad' : undefined} />}
        {total.budget && <Stat label="Budget used" value={pct(budgetUse(total.budget))} sub={total.budget.count ? <BudgetBar actual={total.budget.actual} approved={total.budget.approved} currency={cur} /> : 'No budget for this unit'} />}
        {total.kpi && <Stat label="KPIs" value={kpiScore(total.kpi) === null ? '—' : pct(kpiScore(total.kpi))} sub={kpiScore(total.kpi) === null ? 'No results' : `${RAG[kpiRag(kpiScore(total.kpi))].label} · ${total.kpi.count} results`} />}
        {total.time && <Stat label="Hours" value={hours(total.time.minutes)} sub={`${hours(total.time.billable)} billable`} />}
      </div>

      <Row>
        {childRows.length > 0 && (
          <section className="panel chart-card">
            <div className="chart-head">
              <div>
                <h3>{UNIT_CHILD[unit?.unit_type] || 'Units under it'}</h3>
                <p className="chart-sub">Each with everything under it</p>
              </div>
            </div>
            <Scoreboard
              rows={childRows}
              columns={[
                { key: 'name', label: 'Unit', sort: (r) => r.label.toLowerCase(), render: (r) => <Link to={r.link} className="ins-name">{r.label}</Link> },
                total.people !== null && { key: 'people', label: 'People', align: 'right', sort: (r) => r.people, render: (r) => count(r.people) },
                total.work && { key: 'open', label: 'Open work', sort: (r) => r.work.open, render: (r) => <WorkBar work={r.work} max={maxOpen} /> },
                total.work && { key: 'done', label: 'Done', align: 'right', sort: (r) => r.work.done_recent, render: (r) => count(r.work.done_recent) },
                total.projects && { key: 'proj', label: 'Completion', sort: (r) => avgProgress(r.projects), render: (r) => <ProgressBar value={avgProgress(r.projects)} label="Completion" /> },
                total.budget && { key: 'budget', label: 'Budget used', sort: (r) => budgetUse(r.budget), render: (r) => (r.budget.count ? <BudgetBar actual={r.budget.actual} approved={r.budget.approved} currency={cur} /> : <span className="muted">—</span>) },
                total.kpi && { key: 'kpi', label: 'KPIs', sort: (r) => kpiScore(r.kpi), render: (r) => <KpiChip score={kpiScore(r.kpi)} count={r.kpi.count} /> },
                total.time && { key: 'hours', label: 'Hours', align: 'right', sort: (r) => r.time.minutes, render: (r) => hours(r.time.minutes) },
              ].filter(Boolean)}
              initialSort={{ key: total.work ? 'open' : 'name', dir: -1 }}
            />
          </section>
        )}
      </Row>
      <Row spans={[7, 5]}>
        {own.tasks.data && (
          <ChartCard
            title="Who is doing this unit’s work"
            subtitle={`Open tasks it owns, by person and stage · done in the last ${own.range.days} days`}
            legend={WORK_STAGES.map((s) => ({ label: s.label, color: s.color }))}
            table={{ columns: ['Person', ...WORK_STAGES.map((s) => s.label), 'Late', 'Done'], rows: people.map((p) => [personLabel(p.user_id), ...WORK_STAGES.map((s) => count(p[s.key])), count(p.overdue), count(p.done_recent)]) }}
          >
            <StackedRows
              format={count}
              keys={WORK_STAGES}
              rows={people.map((p) => ({ key: p.user_id || 'nobody', label: personLabel(p.user_id), parts: { todo: p.todo, in_progress: p.in_progress, in_review: p.in_review, blocked: p.blocked }, overdue: p.overdue, done: p.done_recent }))}
              aside={[
                { label: 'Late', render: (r) => (r.overdue ? <span className="flag bad">▲ {count(r.overdue)}</span> : <span className="muted">—</span>) },
                { label: 'Done', render: (r) => (r.done ? <span className="flag good">✓ {count(r.done)}</span> : <span className="muted">—</span>) },
              ]}
            />
          </ChartCard>
        )}
        {all.projects.data && (
          <ChartCard
            title="Projects"
            subtitle={`${count(projects.length)} running here, least complete first`}
            table={{ columns: ['Project', 'Health', 'Done'], rows: projects.map((p) => [p.name, RAG[p.health]?.label || 'Not assessed', pct(p.progress_pct)]) }}
          >
            <ProjectRows projects={projects.slice(0, 8)} />
          </ChartCard>
        )}
      </Row>
      <Row>
        {all.budgets.data && budgets.length > 0 && (
          <ChartCard
            title={`Budgets · ${all.budgets.data.fiscal_year_code}`}
            subtitle="Spent against approved"
            table={{ columns: ['Budget', 'Approved', 'Spent', 'Used'], rows: budgets.map((b) => [b.name, b.approved, b.actual, pct(budgetUse(b))]) }}
          >
            <ul className="ins-projects fill">
              {budgets.map((b) => (
                <li key={b.budget_id}>
                  <div>
                    <strong>{b.name}</strong>
                    <div className="muted small">{b.scope_unit_id !== unitId ? tree.name(b.scope_unit_id) : b.status.replace(/_/g, ' ')}</div>
                  </div>
                  <BudgetBar actual={b.actual} approved={b.approved} currency={b.currency} />
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
        {all.kpis.data && kpis.length > 0 && (
          <ChartCard
            title="KPIs"
            subtitle={all.kpis.data.period?.name || ''}
            table={{ columns: ['KPI', 'Unit', 'Actual', 'Target', 'Achieved'], rows: kpis.map((r) => [r.kpi?.name, tree.name(r.scope.unit_id), r.actual_value ?? '—', r.target_value ?? '—', pct(r.achievement_pct)]) }}
          >
            <KpiRows results={kpis} scopeName={(r) => (r.scope.unit_id !== unitId ? tree.name(r.scope.unit_id) : null)} />
          </ChartCard>
        )}
      </Row>
    </section>
  )
}

// ---------- A person ----------
export function PersonInsights({ userId }) {
  const { orgId } = useActiveOrg()
  const [range, setRange] = useState('quarter')
  const q = useInsightQueries(orgId, {
    range,
    tasks: { assignee: userId },
    time: { user_id: userId },
    need: { units: true, budgets: false, workforce: false },
  })
  const tree = useMemo(() => unitTree(q.units.data ?? []), [q.units.data])
  const tasks = q.tasks.data
  const me = tasks?.people.find((p) => p.user_id === userId) ?? null
  const managed = (q.projects.data?.running_projects ?? []).filter((p) => p.manager_user_id === userId)
  const kpis = (q.kpis.data?.results ?? []).filter((r) => r.scope?.user_id === userId)
  const kpi = kpis.reduce((acc, r) => add.kpi(acc, r), add.kpi())
  const time = q.time.data
  const error = firstError(q.tasks, q.projects, q.time, q.kpis)
  if (![q.tasks, q.projects, q.time, q.kpis].some((x) => x.data || x.loading || x.error)) return null

  return (
    <section className="ins-panel" aria-label="Insights">
      <PanelHead title="What they’re working on" sub="Their tasks, hours, the projects they run and their KPIs" range={range} setRange={setRange} />
      {error && <ErrorBanner error={error.error} onRetry={error.reload} />}
      <div className="ins-stats">
        {tasks && <Stat label="Open work" value={count(me?.open ?? 0)} sub={me?.overdue ? `${count(me.overdue)} late` : 'Nothing late'} tone={me?.overdue ? 'bad' : 'good'} />}
        {tasks && <Stat label={`Done · last ${q.range.days} days`} value={count(me?.done_recent ?? 0)} />}
        {time && <Stat label="Hours" value={hours(time.minutes)} sub={`${pct(time.minutes ? (time.billable_minutes / time.minutes) * 100 : null)} billable`} />}
        {q.projects.data && <Stat label="Projects they run" value={count(managed.length)} sub={managed.length ? `${pct(managed.reduce((s, p) => s + p.progress_pct, 0) / managed.length)} done on average` : 'None running'} />}
        {q.kpis.data && <Stat label="Their KPIs" value={kpiScore(kpi) === null ? '—' : pct(kpiScore(kpi))} sub={kpiScore(kpi) === null ? 'No results this period' : `${RAG[kpiRag(kpiScore(kpi))].label} · ${kpi.count} results`} />}
      </div>
      <Row>
        {tasks && (
          <ChartCard
            title="Their tasks"
            subtitle={`By stage · done in the last ${q.range.days} days`}
            legend={[...WORK_STAGES.map((s) => ({ label: s.label, color: s.color })), { label: 'Done', color: '#94a3b8' }]}
            table={{ columns: ['Week', 'New for them', 'Completed'], rows: tasks.weekly.map((w) => [dayShort.format(new Date(`${w.week_start}T00:00:00`)), count(w.created), count(w.completed)]) }}
          >
            <SegmentedBar parts={workParts(me, 'Done')} format={count} label="Their tasks" />
            <div className="mini-head">New and completed each week</div>
            <LineChart
              height="fill"
              format={count}
              categories={weekCats(tasks.weekly)}
              series={[
                { key: 'created', label: 'New for them', color: SERIES[0], values: tasks.weekly.map((w) => w.created) },
                { key: 'completed', label: 'Completed', color: SERIES[1], values: tasks.weekly.map((w) => w.completed) },
              ]}
            />
          </ChartCard>
        )}
        {time && (
          <ChartCard
            title="Hours recorded"
            subtitle={`${hours(time.minutes)} · ${hours(time.billable_minutes)} billable`}
            legend={[{ label: 'Billable', color: SERIES[0] }, { label: 'Not billable', color: SERIES[1] }]}
            table={{ columns: ['Week', 'Hours', 'Billable'], rows: time.by_week.map((w) => [dayShort.format(new Date(`${w.week_start}T00:00:00`)), hours(w.minutes), hours(w.billable_minutes)]) }}
          >
            <ColumnChart
              height="fill"
              format={hours}
              axisFormat={(v) => `${Math.round(v / 60)} h`}
              categories={weekCats(time.by_week)}
              series={[
                { key: 'b', label: 'Billable', color: SERIES[0], values: time.by_week.map((w) => w.billable_minutes) },
                { key: 'o', label: 'Not billable', color: SERIES[1], values: time.by_week.map((w) => w.minutes - w.billable_minutes) },
              ]}
            />
            {time.by_unit.length > 0 && (
              <>
                <div className="mini-head">For which teams</div>
                <ul className="rank-list">
                  {time.by_unit.slice(0, 5).map((u) => (
                    <li key={u.unit_id || 'none'}>
                      <span>{u.unit_id ? tree.name(u.unit_id) || 'A team' : 'No team'}</span>
                      <span>{hours(u.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ChartCard>
        )}
      </Row>
      <Row>
        {q.projects.data && managed.length > 0 && (
          <ChartCard title="Projects they run" subtitle="Least complete first" table={{ columns: ['Project', 'Health', 'Done'], rows: managed.map((p) => [p.name, RAG[p.health]?.label || 'Not assessed', pct(p.progress_pct)]) }}>
            <ProjectRows projects={managed} tree={tree} />
          </ChartCard>
        )}
        {q.kpis.data && kpis.length > 0 && (
          <ChartCard title="Their KPIs" subtitle={q.kpis.data.period?.name || ''} table={{ columns: ['KPI', 'Actual', 'Target', 'Achieved'], rows: kpis.map((r) => [r.kpi?.name, r.actual_value ?? '—', r.target_value ?? '—', pct(r.achievement_pct)]) }}>
            <KpiRows results={kpis} />
          </ChartCard>
        )}
      </Row>
    </section>
  )
}

// ---------- A project ----------
export function ProjectInsights({ project }) {
  const { orgId } = useActiveOrg()
  const [range, setRange] = useState('half')
  const q = useInsightQueries(orgId, {
    range,
    tasks: { work_unit_id: project.id },
    time: { work_unit_id: project.id },
    need: { units: false, projects: false, budgets: false, workforce: false, kpis: false },
  })
  const names = useDeliveryNames(orgId)
  const tasks = q.tasks.data
  const time = q.time.data
  const error = firstError(q.tasks, q.time)
  const rag = RAG[project.health]
  const people = tasks ? tasks.people.slice(0, 10) : []
  const label = labeler(names, people.map((p) => p.user_id))
  const doneCount = tasks?.by_column.find((c) => c.key === 'done')?.count ?? 0
  const total = tasks ? tasks.open + doneCount : 0
  const minutesOf = (id) => time?.by_user.find((u) => u.user_id === id)?.minutes ?? 0

  return (
    <section className="ins-panel" aria-label="Insights">
      <PanelHead title="How the project is going" sub="Completion, tasks, who works on it and the hours it has taken" range={range} setRange={setRange} />
      {error && <ErrorBanner error={error.error} onRetry={error.reload} />}
      <div className="ins-stats">
        <Stat label="Completion" value={pct(project.progress_pct)} sub={rag ? <><span style={{ color: rag.color }} aria-hidden="true">{rag.icon}</span> {rag.label}</> : 'Health not assessed'} />
        {tasks && <Stat label="Open tasks" value={count(tasks.open)} sub={tasks.overdue ? `${count(tasks.overdue)} late` : 'Nothing late'} tone={tasks.overdue ? 'bad' : 'good'} />}
        {tasks && <Stat label={`Done · last ${q.range.days} days`} value={count(doneCount)} sub={total ? `${pct((doneCount / total) * 100)} of the tasks seen` : undefined} />}
        {time && <Stat label="Hours" value={hours(time.minutes)} sub={`${hours(time.billable_minutes)} billable`} />}
        {tasks && <Stat label="People on it" value={count(tasks.people.filter((p) => p.user_id).length)} sub={tasks.unassigned ? `${count(tasks.unassigned)} tasks unassigned` : undefined} />}
      </div>
      <Row spans={[5, 7]}>
        {tasks && (
          <ChartCard
            title="Tasks"
            subtitle={`By stage · done in the last ${q.range.days} days`}
            legend={[...WORK_STAGES.map((s) => ({ label: s.label, color: s.color })), { label: 'Done', color: '#94a3b8' }]}
            table={{ columns: ['Stage', 'Tasks'], rows: tasks.by_column.map((c) => [c.label || c.key, count(c.count)]) }}
          >
            <SegmentedBar
              format={count}
              label="Tasks"
              parts={tasks.by_column.map((c, i) => ({ label: c.label || c.key, value: c.count, color: c.key === 'done' ? '#94a3b8' : SERIES[i], ink: c.key === 'blocked' ? '#0b0b0b' : '#fff' }))}
            />
            <div className="mini-head">Created and completed each week</div>
            <LineChart
              height="fill"
              format={count}
              categories={weekCats(tasks.weekly)}
              series={[
                { key: 'created', label: 'Created', color: SERIES[0], values: tasks.weekly.map((w) => w.created) },
                { key: 'completed', label: 'Completed', color: SERIES[1], values: tasks.weekly.map((w) => w.completed) },
              ]}
            />
          </ChartCard>
        )}
        {tasks && (
          <ChartCard
            title="Who works on it"
            subtitle="Their open tasks here by stage, and the hours they’ve put in"
            legend={WORK_STAGES.map((s) => ({ label: s.label, color: s.color }))}
            table={{ columns: ['Person', ...WORK_STAGES.map((s) => s.label), 'Done', 'Hours'], rows: people.map((p) => [label(p.user_id), ...WORK_STAGES.map((s) => count(p[s.key])), count(p.done_recent), hours(minutesOf(p.user_id))]) }}
          >
            <StackedRows
              format={count}
              keys={WORK_STAGES}
              rows={people.map((p) => ({ key: p.user_id || 'nobody', label: label(p.user_id), parts: { todo: p.todo, in_progress: p.in_progress, in_review: p.in_review, blocked: p.blocked }, done: p.done_recent, minutes: minutesOf(p.user_id) }))}
              aside={[
                { label: 'Done', render: (r) => (r.done ? <span className="flag good">✓ {count(r.done)}</span> : <span className="muted">—</span>) },
                ...(time ? [{ label: 'Hours', render: (r) => (r.minutes ? hours(r.minutes) : <span className="muted">—</span>) }] : []),
              ]}
            />
          </ChartCard>
        )}
      </Row>
      <Row>
        {time && time.minutes > 0 && (
          <ChartCard
            title="Hours each week"
            subtitle={`${hours(time.minutes)} in all`}
            legend={[{ label: 'Billable', color: SERIES[0] }, { label: 'Not billable', color: SERIES[1] }]}
            table={{ columns: ['Week', 'Hours', 'Billable'], rows: time.by_week.map((w) => [dayShort.format(new Date(`${w.week_start}T00:00:00`)), hours(w.minutes), hours(w.billable_minutes)]) }}
          >
            <ColumnChart
              height="fill"
              format={hours}
              axisFormat={(v) => `${Math.round(v / 60)} h`}
              categories={weekCats(time.by_week)}
              series={[
                { key: 'b', label: 'Billable', color: SERIES[0], values: time.by_week.map((w) => w.billable_minutes) },
                { key: 'o', label: 'Not billable', color: SERIES[1], values: time.by_week.map((w) => w.minutes - w.billable_minutes) },
              ]}
            />
          </ChartCard>
        )}
      </Row>
    </section>
  )
}

// ---------- Shared lists ----------
function ProjectRows({ projects, tree }) {
  if (!projects.length) return <p className="chart-empty">No running projects.</p>
  return (
    <ul className="ins-projects fill">
      {projects.map((p) => {
        const rag = RAG[p.health]
        return (
          <li key={p.id}>
            <div>
              <Link to={`/projects/${p.id}`}>{p.name}</Link>
              <div className="muted small">
                {rag && <span style={{ color: rag.color }} aria-hidden="true">{rag.icon} </span>}
                {rag?.label || 'Not assessed'}
                {tree && p.owning_unit_id && tree.name(p.owning_unit_id) ? ` · ${tree.name(p.owning_unit_id)}` : ''}
                {p.planned_end ? ` · due ${dayShort.format(new Date(`${p.planned_end}T00:00:00`))}` : ''}
              </div>
            </div>
            <ProgressBar value={p.progress_pct} label={`${p.name}: completion`} />
          </li>
        )
      })}
    </ul>
  )
}

function KpiRows({ results, scopeName }) {
  return (
    <ul className="ins-projects fill">
      {[...results]
        .sort((a, b) => (a.achievement_pct ?? 999) - (b.achievement_pct ?? 999))
        .map((r) => {
          const has = r.achievement_pct !== null && r.achievement_pct !== undefined
          const rag = has ? RAG[kpiRag(r.achievement_pct)] : null
          const where = scopeName?.(r)
          return (
            <li key={r.id}>
              <div>
                <strong>{r.kpi?.name || r.kpi?.code}</strong>
                <div className="muted small">
                  {rag ? (
                    <>
                      <span style={{ color: rag.color }} aria-hidden="true">{rag.icon} </span>
                      {rag.label}
                    </>
                  ) : (
                    'No result yet'
                  )}
                  {` · ${r.actual_value ?? '—'} of ${r.target_value ?? '—'}`}
                  {where ? ` · ${where}` : ''}
                </div>
              </div>
              <ProgressBar value={has ? r.achievement_pct : null} label="Achievement" />
            </li>
          )
        })}
    </ul>
  )
}
