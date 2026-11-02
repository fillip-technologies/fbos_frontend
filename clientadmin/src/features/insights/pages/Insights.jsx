import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import {
  BudgetBar,
  count,
  hours,
  KpiChip,
  money,
  pct,
  ProgressBar,
  RAG,
  Scoreboard,
  Stat,
  WORK_STAGES,
  WorkBar,
} from '@/features/insights/components.jsx'
import {
  add,
  avgProgress,
  budgetUse,
  kpiRag,
  kpiScore,
  LEVELS,
  RANGES,
  rollupByLevel,
  unitTree,
  useInsightQueries,
} from '@/features/insights/data.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { BarList, ChartCard, ColumnChart, LineChart, SERIES, StackedRows } from '@/shared/components/Charts.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayShort = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)

// Everything grouped by branch, department, team or person: who has what work, how far the
// projects are, how much budget each unit has used, how its KPIs stand and how much it put out.
export default function Insights() {
  const { orgId } = useActiveOrg()
  const [level, setLevel] = useState('department')
  const [range, setRange] = useState('quarter')
  const q = useInsightQueries(orgId, { range })
  const names = useDeliveryNames(orgId)
  const tree = useMemo(() => unitTree(q.units.data ?? []), [q.units.data])
  const hasUnits = (q.units.data ?? []).length > 0
  const shownLevel = hasUnits ? level : 'person'
  const levelInfo = LEVELS.find((l) => l.key === shownLevel)

  const rows = useMemo(() => buildRows(shownLevel, q, tree, names), [shownLevel, q, tree, names])
  const parts = q
  const loadingFirst = [parts.tasks, parts.projects, parts.time, parts.budgets, parts.workforce].some((x) => x.loading) && rows.length === 0
  const failed = [parts.tasks, parts.projects, parts.time, parts.budgets, parts.workforce, parts.kpis, parts.units].find((x) => x.error && !x.data)
  const currency = parts.budgets.data?.currency || 'INR'
  const isUnit = shownLevel !== 'person'
  const maxOpen = Math.max(1, ...rows.map((r) => r.work?.open ?? 0))

  const columns = [
    {
      key: 'name',
      label: levelInfo.label,
      sort: (r) => r.label.toLowerCase(),
      render: (r) =>
        r.link ? (
          <Link to={r.link} className="ins-name">
            <span className={`mini-avatar${r.id ? '' : ' none'}`}>{r.badge}</span>
            {r.label}
          </Link>
        ) : (
          <span className="ins-name muted">
            <span className="mini-avatar none">–</span>
            {r.label}
          </span>
        ),
    },
    isUnit && parts.workforce.data && { key: 'people', label: 'People', align: 'right', sort: (r) => r.people, render: (r) => (r.people ? count(r.people) : <span className="muted">—</span>) },
    parts.tasks.data && { key: 'open', label: 'Open work', sort: (r) => r.work?.open ?? 0, render: (r) => <WorkBar work={r.work} max={maxOpen} /> },
    parts.tasks.data && { key: 'done', label: `Done · ${parts.range.days} d`, align: 'right', sort: (r) => r.work?.done_recent ?? 0, render: (r) => (r.work?.done_recent ? <span className="flag good">✓ {count(r.work.done_recent)}</span> : <span className="muted">—</span>) },
    parts.tasks.data && { key: 'late', label: 'Late', align: 'right', sort: (r) => r.work?.overdue ?? 0, render: (r) => (r.work?.overdue ? <span className="flag bad">▲ {count(r.work.overdue)}</span> : <span className="muted">—</span>) },
    parts.projects.data && {
      key: 'projects',
      label: isUnit ? 'Project completion' : 'Projects they run',
      sort: (r) => avgProgress(r.projects),
      render: (r) =>
        r.projects?.running ? (
          <span className="ins-proj">
            <ProgressBar value={avgProgress(r.projects)} label="Average completion" />
            <span className="muted small">{count(r.projects.running)} running{r.projects.late ? ` · ${count(r.projects.late)} late` : ''}</span>
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    isUnit && parts.budgets.data && { key: 'budget', label: 'Budget used', sort: (r) => budgetUse(r.budget), render: (r) => (r.budget?.count ? <BudgetBar actual={r.budget.actual} approved={r.budget.approved} currency={currency} /> : <span className="muted">—</span>) },
    parts.kpis.data && { key: 'kpi', label: 'KPIs', sort: (r) => kpiScore(r.kpi), render: (r) => <KpiChip score={kpiScore(r.kpi)} count={r.kpi?.count} /> },
    parts.time.data && { key: 'hours', label: 'Hours', align: 'right', sort: (r) => r.time?.minutes ?? 0, render: (r) => (r.time?.minutes ? <span title={`${hours(r.time.billable)} billable`}>{hours(r.time.minutes)}</span> : <span className="muted">—</span>) },
  ].filter(Boolean)

  const top = (fn, k = 10) => [...rows].filter(fn).slice(0, k)

  return (
    <div className="insights">
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p className="muted small">Work, projects, budgets, KPIs and output — by branch, department, team and person.</p>
        </div>
      </div>

      <div className="overview-filters">
        <OrgSwitcher />
        <div className="segmented" role="group" aria-label="Group by">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={shownLevel === l.key ? 'active' : ''}
              aria-pressed={shownLevel === l.key}
              disabled={!hasUnits && l.key !== 'person'}
              onClick={() => setLevel(l.key)}
            >
              {l.plural}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={range === r.key ? 'active' : ''} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {!hasUnits && !parts.units.loading && <div className="alert info">The company structure isn’t available to you, so everything is shown per person.</div>}
      {failed && <ErrorBanner error={failed.error} onRetry={() => failed.reload()} />}

      <Totals q={parts} currency={currency} />

      <section className="panel ins-board-panel">
        <div className="chart-head">
          <div>
            <h3>{levelInfo.plural} at a glance</h3>
            <p className="chart-sub">
              Open work by stage ({WORK_STAGES.map((s) => s.label.toLowerCase()).join(', ')}), work finished in the period, project completion
              {isUnit ? ', budget spent against approved' : ''}, KPI achievement and hours recorded. Select a name to open its page.
            </p>
          </div>
        </div>
        {loadingFirst ? <PanelSkeleton lines={5} /> : <Scoreboard rows={rows} columns={columns} initialSort={{ key: columns.find((c) => c.key === 'open') ? 'open' : 'name', dir: -1 }} />}
      </section>

      <div className="overview-grid">
        {isUnit && parts.budgets.data && <BudgetCards data={parts.budgets.data} rows={rows} levelInfo={levelInfo} />}
        {parts.projects.data && (
          <ChartCard
            title={`Project completion by ${levelInfo.label.toLowerCase()}`}
            subtitle="Average completion of running projects"
            table={{ columns: [levelInfo.label, 'Running', 'Completion', 'Late'], rows: top((r) => r.projects?.running, 50).map((r) => [r.label, count(r.projects.running), pct(avgProgress(r.projects)), count(r.projects.late)]) }}
          >
            <BarList
              format={pct}
              rows={top((r) => r.projects?.running).sort((a, b) => avgProgress(b.projects) - avgProgress(a.projects)).map((r) => ({ key: r.key, label: r.label, value: avgProgress(r.projects), sub: `${count(r.projects.running)} running`, tipLabel: 'Average completion' }))}
              emptyText="No running projects."
            />
          </ChartCard>
        )}
        {parts.projects.data && <ProjectList data={parts.projects.data} tree={tree} names={names} />}
        {parts.time.data && (
          <ChartCard
            title={`Hours by ${levelInfo.label.toLowerCase()}`}
            subtitle={`${hours(parts.time.data.minutes)} recorded · ${pct(parts.time.data.minutes ? (parts.time.data.billable_minutes / parts.time.data.minutes) * 100 : null)} billable`}
            legend={[{ label: 'Billable', color: SERIES[0] }, { label: 'Not billable', color: SERIES[1] }]}
            table={{ columns: [levelInfo.label, 'Hours', 'Billable'], rows: top((r) => r.time?.minutes, 50).map((r) => [r.label, hours(r.time.minutes), hours(r.time.billable)]) }}
          >
            <StackedRows
              format={hours}
              keys={[{ key: 'billable', label: 'Billable', color: SERIES[0] }, { key: 'other', label: 'Not billable', color: SERIES[1] }]}
              rows={top((r) => r.time?.minutes)
                .sort((a, b) => b.time.minutes - a.time.minutes)
                .map((r) => ({ key: r.key, label: r.label, parts: { billable: r.time.billable, other: r.time.minutes - r.time.billable } }))}
            />
          </ChartCard>
        )}
        {parts.tasks.data && (
          <ChartCard
            title={`Work finished by ${levelInfo.label.toLowerCase()}`}
            subtitle={`Tasks done in the last ${parts.range.days} days`}
            table={{ columns: [levelInfo.label, 'Done', 'Open', 'Late'], rows: top((r) => r.work, 50).map((r) => [r.label, count(r.work.done_recent), count(r.work.open), count(r.work.overdue)]) }}
          >
            <BarList
              format={count}
              rows={top((r) => r.work?.done_recent).sort((a, b) => b.work.done_recent - a.work.done_recent).map((r) => ({ key: r.key, label: r.label, value: r.work.done_recent, sub: `${count(r.work.open)} open`, tipLabel: 'Tasks done' }))}
              emptyText="Nothing finished in this period."
            />
          </ChartCard>
        )}
        {parts.kpis.data && <KpiCards data={parts.kpis.data} rows={rows} levelInfo={levelInfo} tree={tree} names={names} />}
        {parts.tasks.data && parts.time.data && (
          <ChartCard
            title="Week by week"
            subtitle="Tasks created and completed, and hours recorded"
            table={{
              columns: ['Week', 'Created', 'Completed'],
              rows: parts.tasks.data.weekly.map((w) => [dayShort.format(new Date(`${w.week_start}T00:00:00`)), count(w.created), count(w.completed)]),
            }}
          >
            <LineChart
              height={180}
              format={count}
              categories={parts.tasks.data.weekly.map((w) => ({ key: w.week_start, label: dayShort.format(new Date(`${w.week_start}T00:00:00`)), title: `Week of ${dayShort.format(new Date(`${w.week_start}T00:00:00`))}` }))}
              series={[
                { key: 'created', label: 'Created', color: SERIES[0], values: parts.tasks.data.weekly.map((w) => w.created) },
                { key: 'completed', label: 'Completed', color: SERIES[1], values: parts.tasks.data.weekly.map((w) => w.completed) },
              ]}
            />
            <ul className="chart-legend inline">
              <li><span className="legend-key line" style={{ background: SERIES[0] }} />Created</li>
              <li><span className="legend-key line" style={{ background: SERIES[1] }} />Completed</li>
            </ul>
            <div className="mini-head">Hours recorded</div>
            <ColumnChart
              height={150}
              format={hours}
              axisFormat={(v) => `${Math.round(v / 60)} h`}
              categories={parts.time.data.by_week.map((w) => ({ key: w.week_start, label: dayShort.format(new Date(`${w.week_start}T00:00:00`)), title: `Week of ${dayShort.format(new Date(`${w.week_start}T00:00:00`))}` }))}
              series={[{ key: 'h', label: 'Hours', color: SERIES[0], values: parts.time.data.by_week.map((w) => w.minutes) }]}
            />
          </ChartCard>
        )}
      </div>
    </div>
  )
}

// ---------- Rows of the scoreboard ----------
function buildRows(level, q, tree, names) {
  const tasks = q.tasks.data
  const projects = q.projects.data
  const time = q.time.data
  const budgets = q.budgets.data
  const workforce = q.workforce.data
  const kpiResults = q.kpis.data?.results ?? []

  if (level === 'person') {
    const ids = new Set()
    for (const p of tasks?.people ?? []) if (p.user_id) ids.add(p.user_id)
    for (const t of time?.by_user ?? []) if (t.user_id) ids.add(t.user_id)
    for (const r of kpiResults) if (r.scope?.user_id) ids.add(r.scope.user_id)
    for (const p of projects?.running_projects ?? []) if (p.manager_user_id) ids.add(p.manager_user_id)
    let unnamed = 0
    return [...ids].map((id) => {
      const known = names.personName(id)
      const label = known && known !== '—' ? known : `Person ${++unnamed}`
      const managed = (projects?.running_projects ?? []).filter((p) => p.manager_user_id === id)
      return {
        key: id,
        id,
        label,
        badge: label[0],
        link: `/users/${id}`,
        work: tasks?.people.find((p) => p.user_id === id),
        time: add.time(undefined, time?.by_user.find((t) => t.user_id === id)),
        kpi: kpiResults.filter((r) => r.scope?.user_id === id).reduce((acc, r) => add.kpi(acc, r), add.kpi()),
        projects: managed.length
          ? {
              running: managed.length,
              progressSum: managed.reduce((s, p) => s + p.progress_pct, 0),
              late: managed.filter((p) => p.planned_end && new Date(`${p.planned_end}T00:00:00`) < new Date()).length,
            }
          : null,
      }
    })
  }

  const work = rollupByLevel(tasks?.units ?? [], (r) => r.unit_id, level, tree, add.work)
  const proj = rollupByLevel(projects?.units ?? [], (r) => r.unit_id, level, tree, add.projects)
  const budget = rollupByLevel((budgets?.budgets ?? []).filter((b) => b.scope_unit_id), (b) => b.scope_unit_id, level, tree, add.budget)
  const hrs = rollupByLevel(time?.by_unit ?? [], (r) => r.unit_id, level, tree, add.time)
  const people = rollupByLevel(workforce?.by_unit ?? [], (r) => r.unit_id, level, tree, add.people)
  const kpi = rollupByLevel(kpiResults.filter((r) => r.scope?.unit_id), (r) => r.scope.unit_id, level, tree, add.kpi)

  const keys = new Set([...tree.byId.values()].filter((u) => u.unit_type === level && u.status !== 'deleted').map((u) => u.id))
  for (const map of [work, proj, budget, hrs, people, kpi]) for (const k of map.keys()) keys.add(k)
  const levelLabel = LEVELS.find((l) => l.key === level).label.toLowerCase()
  return [...keys]
    .map((id) => ({
      key: id ?? 'none',
      id,
      label: id ? tree.name(id) || 'Unit' : `Not in any ${levelLabel}`,
      badge: id ? (tree.name(id) || '?')[0] : '–',
      link: id ? `/org-units/${id}` : null,
      work: work.get(id),
      projects: proj.get(id),
      budget: budget.get(id),
      time: hrs.get(id),
      people: people.get(id) ?? 0,
      kpi: kpi.get(id),
    }))
    .filter((r) => r.id || r.work?.open || r.work?.done_recent || r.projects?.total || r.budget?.count || r.time?.minutes || r.people || r.kpi?.count)
}

// ---------- Top numbers ----------
function Totals({ q, currency }) {
  const tasks = q.tasks.data
  const projects = q.projects.data
  const budgets = q.budgets.data
  const time = q.time.data
  const people = q.workforce.data
  const kpis = q.kpis.data
  const score = kpis ? kpiScore(kpis.results.reduce((acc, r) => add.kpi(acc, r), add.kpi())) : null
  const stats = [
    people && <Stat key="p" label="People" value={count(people.headcount)} sub={`${people.by_unit.length} units`} to="/users" />,
    tasks && <Stat key="t" label="Open work" value={count(tasks.open)} sub={tasks.overdue ? `${count(tasks.overdue)} late` : 'Nothing late'} tone={tasks.overdue ? 'bad' : 'good'} to="/tasks" />,
    projects && <Stat key="pr" label="Project completion" value={pct(projects.average_progress_pct)} sub={`${count(projects.running)} running · ${count(projects.late)} late`} tone={projects.late ? 'bad' : undefined} to="/projects" />,
    budgets && (
      <Stat
        key="b"
        label={`Budget used · ${budgets.fiscal_year_code}`}
        value={pct(budgetUse({ approved: budgets.approved, actual: budgets.actual }))}
        sub={`${money(budgets.actual, currency)} of ${money(budgets.approved, currency)} approved`}
        tone={budgets.actual > budgets.approved && budgets.approved > 0 ? 'bad' : undefined}
        to="/budgets"
      />
    ),
    kpis && (
      <Stat
        key="k"
        label={`KPIs · ${kpis.period?.name || kpis.period?.code || 'no period'}`}
        value={score === null ? '—' : pct(score)}
        sub={score === null ? 'No results yet' : `${RAG[kpiRag(score)].label} · ${count(kpis.results.length)} results`}
        tone={score !== null && kpiRag(score) === 'red' ? 'bad' : undefined}
        to="/scorecard"
      />
    ),
    time && <Stat key="h" label="Hours recorded" value={hours(time.minutes)} sub={`${hours(time.billable_minutes)} billable`} />,
  ].filter(Boolean)
  if (!stats.length) return null
  return <div className="ins-stats">{stats}</div>
}

// ---------- Budgets ----------
function BudgetCards({ data, rows, levelInfo }) {
  const cur = data.currency
  const withBudget = rows.filter((r) => r.budget?.count).sort((a, b) => b.budget.approved - a.budget.approved).slice(0, 10)
  const companyWide = data.budgets.filter((b) => !b.scope_unit_id)
  return (
    <>
      <ChartCard
        title={`Budget by ${levelInfo.label.toLowerCase()}`}
        subtitle={`${data.fiscal_year_code} · approved and spent${data.mixed_currencies ? ' · some budgets use other currencies and are added as they are' : ''}${companyWide.length ? ` · ${companyWide.length} company-wide budget${companyWide.length === 1 ? '' : 's'} not shown here` : ''}`}
        legend={[{ label: 'Approved', color: SERIES[0] }, { label: 'Spent', color: SERIES[1] }]}
        table={{
          columns: [levelInfo.label, 'Planned', 'Approved', 'Spent', 'Used'],
          rows: withBudget.map((r) => [r.label, money(r.budget.planned, cur, false), money(r.budget.approved, cur, false), money(r.budget.actual, cur, false), pct(budgetUse(r.budget))]),
        }}
      >
        {withBudget.length ? (
          <ColumnChart
            format={(v) => money(v, cur)}
            categories={withBudget.map((r) => ({ key: r.key, label: r.label.length > 12 ? `${r.label.slice(0, 11)}…` : r.label, title: r.label }))}
            series={[
              { key: 'approved', label: 'Approved', color: SERIES[0], values: withBudget.map((r) => r.budget.approved) },
              { key: 'spent', label: 'Spent', color: SERIES[1], values: withBudget.map((r) => r.budget.actual) },
            ]}
          />
        ) : (
          <p className="chart-empty">No budget is set for a {levelInfo.label.toLowerCase()} in {data.fiscal_year_code}.</p>
        )}
      </ChartCard>
      <ChartCard
        title="Where the budget goes"
        subtitle={`${money(data.actual, cur)} spent of ${money(data.approved, cur)} approved · by category and month`}
        table={{
          columns: ['Category', 'Planned', 'Approved', 'Spent'],
          rows: data.by_category.map((c) => [c.category, money(c.planned, cur, false), money(c.approved, cur, false), money(c.actual, cur, false)]),
        }}
        action={<Link className="link-btn" to="/budgets">Budgets</Link>}
      >
        <BarList format={(v) => money(v, cur)} rows={data.by_category.slice(0, 6).map((c) => ({ key: c.category, label: c.category, value: c.actual, sub: `of ${money(c.approved, cur)}`, tipLabel: 'Spent' }))} emptyText="Nothing spent yet." />
        <div className="mini-head">Spent per month</div>
        <ColumnChart
          height={150}
          format={(v) => money(v, cur)}
          categories={data.actual_by_month.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: monthLong.format(monthOf(m.month)) }))}
          series={[{ key: 'spent', label: 'Spent', color: SERIES[1], values: data.actual_by_month.map((m) => m.actual) }]}
        />
      </ChartCard>
    </>
  )
}

// ---------- Projects ----------
function ProjectList({ data, tree, names }) {
  const list = data.running_projects.slice(0, 12)
  return (
    <ChartCard
      title="Running projects"
      subtitle="Least complete first"
      action={<Link className="link-btn" to="/projects">Projects</Link>}
      table={{
        columns: ['Project', 'Unit', 'Health', 'Done'],
        rows: data.running_projects.map((p) => [p.name, p.owning_unit_id ? tree.name(p.owning_unit_id) || '—' : '—', RAG[p.health]?.label || 'Not assessed', pct(p.progress_pct)]),
      }}
    >
      {list.length ? (
        <ul className="ins-projects">
          {list.map((p) => {
            const rag = RAG[p.health]
            const manager = names.personName(p.manager_user_id)
            return (
              <li key={p.id}>
                <div>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  <div className="muted small">
                    {rag && <span style={{ color: rag.color }} aria-hidden="true">{rag.icon} </span>}
                    {rag?.label || 'Not assessed'}
                    {p.owning_unit_id && tree.name(p.owning_unit_id) ? ` · ${tree.name(p.owning_unit_id)}` : ''}
                    {manager && manager !== '—' ? ` · ${manager}` : ''}
                  </div>
                </div>
                <ProgressBar value={p.progress_pct} label={`${p.name}: completion`} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="chart-empty">No running projects.</p>
      )}
    </ChartCard>
  )
}

// ---------- KPIs ----------
function KpiCards({ data, rows, levelInfo, tree, names }) {
  const scored = rows.filter((r) => kpiScore(r.kpi) !== null).sort((a, b) => kpiScore(b.kpi) - kpiScore(a.kpi))
  const lowest = [...data.results].filter((r) => r.achievement_pct !== null && r.achievement_pct !== undefined).sort((a, b) => a.achievement_pct - b.achievement_pct).slice(0, 8)
  const scopeName = (s) => (s?.user_id ? names.personName(s.user_id) : s?.unit_id ? tree.name(s.unit_id) : null) || 'Company'
  return (
    <ChartCard
      title={`KPIs by ${levelInfo.label.toLowerCase()}`}
      subtitle={`${data.period ? data.period.name || data.period.code : 'No planning period covers today'} · average achievement of their KPI results`}
      action={<Link className="link-btn" to="/scorecard">Scorecard</Link>}
      table={{
        columns: ['KPI', 'For', 'Actual', 'Target', 'Achieved'],
        rows: data.results.map((r) => [r.kpi?.name || r.kpi?.code, scopeName(r.scope), r.actual_value ?? '—', r.target_value ?? '—', pct(r.achievement_pct)]),
      }}
    >
      {scored.length ? (
        <BarList format={pct} rows={scored.slice(0, 8).map((r) => ({ key: r.key, label: r.label, value: kpiScore(r.kpi), sub: `${RAG[kpiRag(kpiScore(r.kpi))].icon} ${r.kpi.count}`, tipLabel: 'Average achievement' }))} />
      ) : (
        <p className="chart-empty">No KPI results for a {levelInfo.label.toLowerCase()} in this period.</p>
      )}
      {lowest.length > 0 && (
        <>
          <div className="mini-head">Furthest from target</div>
          <ul className="ins-projects">
            {lowest.map((r) => {
              const rag = RAG[kpiRag(r.achievement_pct)]
              return (
                <li key={r.id}>
                  <div>
                    <strong>{r.kpi?.name || r.kpi?.code}</strong>
                    <div className="muted small">
                      <span style={{ color: rag.color }} aria-hidden="true">{rag.icon} </span>
                      {rag.label} · {scopeName(r.scope)}
                    </div>
                  </div>
                  <ProgressBar value={r.achievement_pct} label="Achievement" />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </ChartCard>
  )
}
