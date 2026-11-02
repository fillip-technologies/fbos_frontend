import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { overviewApi } from '@/features/dashboard/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import {
  BarList,
  ChartCard,
  ColumnChart,
  LineChart,
  ORDINAL,
  Ring,
  SegmentedBar,
  SERIES,
  StackedRows,
  STATUS,
  useCountUp,
} from '@/shared/components/Charts.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// ---------- Formatting ----------
const num = (n) => Number(n ?? 0)
const count = (n) => Math.round(num(n)).toLocaleString()
const money = (amount, currency = 'INR', compact = true) => {
  try {
    return num(amount).toLocaleString(undefined, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    })
  } catch {
    return `${count(amount)} ${currency}`
  }
}
const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayShort = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

const LABELS = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', disqualified: 'Disqualified',
  qualification: 'Qualification', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
  draft: 'Draft', pending_approval: 'Waiting approval', issued: 'Issued', partially_paid: 'Part paid', overdue: 'Overdue',
  paid: 'Paid', written_off: 'Written off', cancelled: 'Cancelled', current: 'Not due yet', '1_30': '1–30 days late',
  '31_60': '31–60 days late', '61_90': '61–90 days late', '90_plus': '90+ days late',
  active: 'Active', probation: 'Probation', on_leave: 'On leave', noticed: 'Serving notice', exited: 'Left',
  present: 'Present', half_day: 'Half day', regularized: 'Regularized', absent: 'Absent', holiday: 'Holiday',
  full_time: 'Full time', part_time: 'Part time', contractor: 'Contractor', intern: 'Intern',
  website: 'Website', referral: 'Referral', campaign: 'Campaign', walk_in: 'Walk-in', partner: 'Partner', other: 'Other', unknown: 'Not recorded',
  bank_transfer: 'Bank transfer', upi: 'UPI', cheque: 'Cheque', card: 'Card', gateway: 'Online', cash: 'Cash',
  p1: 'P1 · urgent', p2: 'P2 · high', p3: 'P3 · normal', p4: 'P4 · low',
}
const label = (key) => LABELS[key] ?? String(key).replace(/_/g, ' ')

const WORK_KEYS = [
  { key: 'todo', label: 'To do', color: SERIES[0] },
  { key: 'in_progress', label: 'In progress', color: SERIES[1] },
  { key: 'in_review', label: 'In review', color: SERIES[2] },
  { key: 'blocked', label: 'Blocked', color: SERIES[3] },
]
const HEALTH = {
  green: { label: 'On track', color: STATUS.good, icon: '●' },
  amber: { label: 'At risk', color: STATUS.warning, icon: '▲' },
  red: { label: 'Off track', color: STATUS.critical, icon: '■' },
  unknown: { label: 'Not assessed', color: '#a29d8f', icon: '○' },
}
const WINDOWS = [3, 6, 12]

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- Data: one query per service summary the user may read ----------
function useOverview(orgId, months) {
  const { user } = useAuth()
  const can = (rule) => Boolean(orgId) && hasAccess(user, rule)
  const weeks = Math.min(26, months * 4 + 1)
  const opts = (rule) => ({ enabled: can(rule), keepPrevious: true })
  const now = new Date()
  const from = isoDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return {
    leads: useQuery(['overview', orgId, 'leads', months], (o) => overviewApi.leads(orgId, months, o), opts(ACCESS.leads)),
    opportunities: useQuery(['overview', orgId, 'opportunities'], (o) => overviewApi.opportunities(orgId, o), opts(ACCESS.opportunities)),
    contracts: useQuery(['overview', orgId, 'contracts'], (o) => overviewApi.contracts(orgId, o), opts(ACCESS.contracts)),
    invoices: useQuery(['overview', orgId, 'invoices', months], (o) => overviewApi.invoices(orgId, months, o), opts(ACCESS.invoices)),
    payments: useQuery(['overview', orgId, 'payments', months], (o) => overviewApi.payments(orgId, months, o), opts(ACCESS.payments)),
    tasks: useQuery(['overview', orgId, 'tasks', weeks], (o) => overviewApi.tasks(orgId, weeks, o), opts(ACCESS.tasks)),
    projects: useQuery(['overview', orgId, 'projects'], (o) => overviewApi.projects(orgId, o), opts(ACCESS.projects)),
    workforce: useQuery(['overview', orgId, 'workforce', months], (o) => overviewApi.workforce(orgId, months, o), opts(ACCESS.people)),
    utilization: useQuery(['overview', orgId, 'utilization', from], (o) => overviewApi.utilization(orgId, from, to, o), opts(ACCESS.capacity)),
  }
}

// ---------- The overview ----------
export default function Overview() {
  const { orgId, activeOrg } = useActiveOrg()
  const [months, setMonths] = useState(6)
  const q = useOverview(orgId, months)
  const names = useDeliveryNames(orgId)
  const queries = Object.values(q).filter((x) => x.loading || x.data || x.error)
  if (queries.length === 0) return null // nothing here this person may read

  const refreshing = queries.some((x) => x.refreshing || x.fetching)
  const failed = Object.entries(q).filter(([, x]) => x.error && !x.data)
  const reloadAll = () => queries.forEach((x) => x.reload())

  return (
    <section className={`overview${refreshing ? ' is-refetching' : ''}`} aria-label="Company overview">
      <div className="home-section-head overview-head">
        <h2>How {activeOrg?.name || 'the company'} is doing</h2>
        <span>Live from sales, billing, delivery and people</span>
      </div>

      <div className="overview-filters">
        <OrgSwitcher />
        <div className="segmented" role="group" aria-label="Period">
          {WINDOWS.map((m) => (
            <button key={m} type="button" className={months === m ? 'active' : ''} aria-pressed={months === m} onClick={() => setMonths(m)}>
              {m} months
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn secondary small-btn" onClick={reloadAll} aria-busy={refreshing}>
          Refresh
        </button>
      </div>

      {failed.length > 0 && (
        <ErrorBanner error={failed[0][1].error} onRetry={reloadAll} />
      )}

      <Headlines q={q} />
      <FlowStrip q={q} />

      <div className="overview-grid">
        <SalesCards q={q} names={names} />
        <MoneyCards q={q} />
        <WorkCards q={q} names={names} />
        <PeopleCards q={q} names={names} />
      </div>
    </section>
  )
}

// ---------- Headline numbers ----------
function Kpi({ title, value, format, sub, tone, to }) {
  const shown = useCountUp(num(value))
  const body = (
    <>
      <div className="kpi-label">{title}</div>
      <div className="kpi-value">{format(shown)}</div>
      {sub && <div className={`kpi-sub${tone ? ` ${tone}` : ''}`}>{sub}</div>}
    </>
  )
  return to ? (
    <Link to={to} className="kpi">
      {body}
    </Link>
  ) : (
    <div className="kpi">{body}</div>
  )
}

function Headlines({ q }) {
  const opp = q.opportunities.data
  const inv = q.invoices.data
  const pay = q.payments.data
  const tasks = q.tasks.data
  const projects = q.projects.data
  const people = q.workforce.data
  const present = people?.attendance_today?.by_status?.find((b) => b.key === 'present')?.count
  const tiles = [
    opp && {
      key: 'pipeline', title: 'Open pipeline', value: opp.open_value.amount, format: (v) => money(v, opp.currency), to: '/opportunities',
      sub: `${money(opp.weighted_value.amount, opp.currency)} weighted by chance`,
    },
    inv && {
      key: 'outstanding', title: 'Money owed to you', value: inv.outstanding.amount, format: (v) => money(v, inv.currency), to: '/collections',
      sub: num(inv.overdue.amount) > 0 ? `${money(inv.overdue.amount, inv.currency)} is late` : 'Nothing late', tone: num(inv.overdue.amount) > 0 ? 'bad' : 'good',
    },
    pay && {
      key: 'collected', title: 'Collected', value: pay.collected.amount, format: (v) => money(v, pay.currency), to: '/payments',
      sub: `in the last ${pay.collected_by_month.length} months`,
    },
    tasks && {
      key: 'tasks', title: 'Open tasks', value: tasks.open, format: count, to: '/tasks',
      sub: tasks.overdue ? `${count(tasks.overdue)} overdue` : 'None overdue', tone: tasks.overdue ? 'bad' : 'good',
    },
    projects && {
      key: 'projects', title: 'Running projects', value: projects.running, format: count, to: '/projects',
      sub: projects.late ? `${count(projects.late)} past their end date` : 'All on schedule', tone: projects.late ? 'bad' : 'good',
    },
    people && {
      key: 'people', title: 'People', value: people.headcount, format: count, to: '/users',
      sub: present !== undefined && people.attendance_today ? `${count(present)} of ${count(people.attendance_today.expected)} in today` : `${people.by_unit.length} departments`,
    },
  ].filter(Boolean)
  if (!tiles.length) return null
  return (
    <div className="kpi-row">
      {tiles.map(({ key, ...t }) => (
        <Kpi key={key} {...t} />
      ))}
    </div>
  )
}

// ---------- From lead to cash ----------
function FlowStrip({ q }) {
  const leads = q.leads.data
  const opp = q.opportunities.data
  const contracts = q.contracts.data
  const inv = q.invoices.data
  const pay = q.payments.data
  if (![leads, opp, contracts, inv, pay].some(Boolean)) return null

  const leadCount = (k) => leads?.by_status.find((b) => b.key === k)?.count ?? 0
  const stage = (k) => opp?.by_stage.find((s) => s.stage === k)
  const openStages = ['qualification', 'proposal', 'negotiation'].map(stage).filter(Boolean)
  const won = stage('won')
  const lost = stage('lost')
  const decided = (won?.count ?? 0) + (lost?.count ?? 0)
  const active = contracts?.by_status.find((s) => s.status === 'active')
  const invoiced = inv?.invoiced_by_month.reduce((s, m) => s + num(m.amount.amount), 0)
  const collected = pay ? num(pay.collected.amount) : null
  const cur = inv?.currency || pay?.currency || opp?.currency || 'INR'

  const steps = [
    leads && {
      key: 'leads', to: '/leads', title: 'Leads', big: count(leadCount('new') + leadCount('contacted') + leadCount('qualified')),
      note: 'open now', detail: `${count(leadCount('converted'))} converted so far`,
    },
    opp && {
      key: 'opps', to: '/opportunities', title: 'Opportunities', big: count(openStages.reduce((s, x) => s + x.count, 0)),
      note: money(opp.open_value.amount, opp.currency), detail: 'in the pipeline',
    },
    opp && {
      key: 'won', to: '/opportunities', title: 'Won', big: count(won?.count),
      note: money(won?.value.amount, opp.currency), detail: decided ? `${pct(won?.count ?? 0, decided)}% win rate` : 'none decided yet',
    },
    contracts && {
      key: 'contracts', to: '/contracts', title: 'Active contracts', big: count(active?.count),
      note: money(contracts.active_value.amount, contracts.currency), detail: 'under contract',
    },
    inv && {
      key: 'invoiced', to: '/invoices', title: 'Invoiced', big: money(invoiced, cur),
      note: `${inv.invoiced_by_month.length} months`, detail: `${money(inv.outstanding.amount, cur)} still owed`,
    },
    pay && {
      key: 'collected', to: '/payments', title: 'Collected', big: money(collected, cur),
      note: `${pay.collected_by_month.length} months`,
      detail: invoiced ? `${pct(collected, invoiced)}% of what was invoiced` : 'received',
    },
  ].filter(Boolean)

  return (
    <section className="panel flow" aria-label="From lead to cash">
      <div className="flow-head">
        <h3>From lead to cash</h3>
        <span className="chart-sub">Where the business is right now, step by step</span>
      </div>
      <ol className="flow-steps">
        {steps.map((s, i) => (
          <li key={s.key} className="flow-step" style={{ '--i': i }}>
            <Link to={s.to}>
              <span className="flow-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="flow-title">{s.title}</span>
              <span className="flow-big">{s.big}</span>
              <span className="flow-note">{s.note}</span>
              <span className="flow-detail">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---------- Sales ----------
// A person's name, or null when the user may not read the user list (delivery and revenue
// store ids only). Lists then number the people instead and say why.
function knownName(names, id) {
  const name = id ? names.personName(id) : null
  return name && name !== '—' ? name : null
}
function personLabel(names, id, index) {
  if (!id) return 'Unassigned'
  return knownName(names, id) || `Person ${index + 1}`
}
const HIDDEN_NAMES = 'Names show for people who may see the user list.'

function SalesCards({ q, names }) {
  const opp = q.opportunities.data
  const leads = q.leads.data
  if (!opp && !leads) return null
  const stages = opp?.by_stage ?? []
  const leadParts = (leads?.by_status ?? []).map((b, i) => ({ label: label(b.key), value: b.count, color: [...SERIES, '#a29d8f'][Math.min(i, 4)] }))
  return (
    <>
      {opp && (
        <ChartCard
          title="Pipeline by stage"
          subtitle={`Value of opportunities in each stage · ${money(opp.weighted_value.amount, opp.currency)} weighted`}
          table={{ columns: ['Stage', 'Deals', 'Value'], rows: stages.map((s) => [label(s.stage), count(s.count), money(s.value.amount, opp.currency, false)]) }}
        >
          <BarList
            format={(v) => money(v, opp.currency)}
            rows={stages.map((s) => ({ key: s.stage, label: label(s.stage), value: num(s.value.amount), sub: `${count(s.count)} deal${s.count === 1 ? '' : 's'}`, tipLabel: `${count(s.count)} deals` }))}
          />
        </ChartCard>
      )}
      {leads && (
        <ChartCard
          title="Leads"
          subtitle={`${count(leads.total)} in all · where they stand and where they came from`}
          legend={leadParts.map((p) => ({ label: p.label, color: p.color }))}
          table={{
            columns: ['Status or source', 'Leads'],
            rows: [...leads.by_status.map((b) => [label(b.key), count(b.count)]), ...leads.by_source.map((b) => [`Source: ${label(b.key)}`, count(b.count)])],
          }}
        >
          <SegmentedBar parts={leadParts} format={count} label="Leads" />
          <div className="chart-split">
            <div>
              <div className="mini-head">New leads per month</div>
              <ColumnChart
                height={150}
                format={count}
                categories={leads.created_by_month.map((m) => ({ key: m.key, label: monthShort.format(monthOf(m.key)), title: monthLong.format(monthOf(m.key)) }))}
                series={[{ key: 'new', label: 'New leads', color: SERIES[0], values: leads.created_by_month.map((m) => m.count) }]}
              />
            </div>
            <div>
              <div className="mini-head">Where they came from</div>
              <BarList format={count} rows={leads.by_source.slice(0, 5).map((b) => ({ key: b.key, label: label(b.key), value: b.count, tipLabel: 'Leads' }))} />
            </div>
          </div>
        </ChartCard>
      )}
      {opp && opp.by_owner.length > 0 && (
        <ChartCard
          title="Who is selling"
          subtitle={`Open pipeline and wins per owner${opp.by_owner.some((o) => !knownName(names, o.user_id)) ? ` · ${HIDDEN_NAMES}` : ''}`}
          table={{
            columns: ['Owner', 'Open deals', 'Open value', 'Won', 'Won value'],
            rows: opp.by_owner.map((o, i) => [personLabel(names, o.user_id, i), count(o.open_count), money(o.open_value.amount, opp.currency, false), count(o.won_count), money(o.won_value.amount, opp.currency, false)]),
          }}
          legend={[{ label: 'Open value', color: SERIES[0] }, { label: 'Won value', color: SERIES[1] }]}
        >
          <ColumnChart
            format={(v) => money(v, opp.currency)}
            categories={opp.by_owner.slice(0, 8).map((o, i) => ({ key: o.user_id, label: initialsOf(personLabel(names, o.user_id, i)), title: personLabel(names, o.user_id, i) }))}
            series={[
              { key: 'open', label: 'Open value', color: SERIES[0], values: opp.by_owner.slice(0, 8).map((o) => num(o.open_value.amount)) },
              { key: 'won', label: 'Won value', color: SERIES[1], values: opp.by_owner.slice(0, 8).map((o) => num(o.won_value.amount)) },
            ]}
          />
        </ChartCard>
      )}
    </>
  )
}

function initialsOf(name) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

// ---------- Money ----------
function MoneyCards({ q }) {
  const inv = q.invoices.data
  const pay = q.payments.data
  if (!inv && !pay) return null
  const cur = inv?.currency || pay?.currency || 'INR'
  const months = (inv?.invoiced_by_month ?? pay?.collected_by_month ?? []).map((m) => m.month)
  const series = [
    inv && { key: 'invoiced', label: 'Invoiced', color: SERIES[0], values: inv.invoiced_by_month.map((m) => num(m.amount.amount)) },
    pay && { key: 'collected', label: 'Collected', color: SERIES[1], values: months.map((k) => num(pay.collected_by_month.find((m) => m.month === k)?.amount.amount)) },
  ].filter(Boolean)
  const mixed = inv?.mixed_currencies || pay?.mixed_currencies
  return (
    <>
      <ChartCard
        title={series.length > 1 ? 'Invoiced and collected' : series[0].label}
        subtitle={`Per month${mixed ? ' · some records use other currencies and are added as they are' : ''}`}
        legend={series.length > 1 ? series.map((s) => ({ label: s.label, color: s.color })) : undefined}
        table={{ columns: ['Month', ...series.map((s) => s.label)], rows: months.map((k, i) => [monthLong.format(monthOf(k)), ...series.map((s) => money(s.values[i], cur, false))]) }}
      >
        <ColumnChart
          format={(v) => money(v, cur)}
          categories={months.map((k) => ({ key: k, label: monthShort.format(monthOf(k)), title: monthLong.format(monthOf(k)) }))}
          series={series}
        />
      </ChartCard>
      {inv && (
        <ChartCard
          title="How late is the money owed"
          subtitle={`${money(inv.outstanding.amount, cur)} owed · ${money(inv.overdue.amount, cur)} past due`}
          table={{ columns: ['Age', 'Invoices', 'Owed'], rows: inv.aging.map((a) => [label(a.key), count(a.count), money(a.amount.amount, cur, false)]) }}
          action={<Link className="link-btn" to="/collections">Collections</Link>}
        >
          <BarList
            format={(v) => money(v, cur)}
            colors={ORDINAL}
            rows={inv.aging.map((a) => ({ key: a.key, label: label(a.key), value: num(a.amount.amount), sub: `${count(a.count)} inv.`, tipLabel: `${count(a.count)} invoices` }))}
          />
          {inv.top_balances.length > 0 && (
            <>
              <div className="mini-head">Owes you the most</div>
              <ol className="rank-list">
                {inv.top_balances.map((c) => (
                  <li key={c.client_id}>
                    <Link to={`/customers/${c.client_id}`}>{c.name || 'Customer'}</Link>
                    <span>{money(c.balance.amount, cur, false)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </ChartCard>
      )}
      {inv && (
        <ChartCard
          title="Invoices by status"
          subtitle="How many, and what each group is worth"
          table={{ columns: ['Status', 'Invoices', 'Total', 'Still owed'], rows: inv.by_status.map((s) => [label(s.status), count(s.count), money(s.total.amount, cur, false), money(s.balance.amount, cur, false)]) }}
        >
          <BarList
            format={count}
            rows={inv.by_status.map((s) => ({ key: s.status, label: label(s.status), value: s.count, sub: money(s.total.amount, cur), tipLabel: 'Invoices' }))}
          />
        </ChartCard>
      )}
    </>
  )
}

// ---------- Work ----------
function WorkCards({ q, names }) {
  const tasks = q.tasks.data
  const projects = q.projects.data
  if (!tasks && !projects) return null
  const columns = tasks?.by_column ?? []
  const people = (tasks?.people ?? []).slice(0, 12)
  return (
    <>
      {tasks && (
        <ChartCard
          wide
          title="Who is doing what"
          subtitle={`Open tasks per person by stage · late work and what each finished in the last ${tasks.done_within_days} days${people.some((p) => p.user_id && !knownName(names, p.user_id)) ? ` · ${HIDDEN_NAMES}` : ''}`}
          legend={WORK_KEYS.map((k) => ({ label: k.label, color: k.color }))}
          action={<Link className="link-btn" to="/tasks">Tasks</Link>}
          table={{
            columns: ['Person', ...WORK_KEYS.map((k) => k.label), 'Overdue', 'Done lately'],
            rows: people.map((p, i) => [personLabel(names, p.user_id, i), ...WORK_KEYS.map((k) => count(p[k.key])), count(p.overdue), count(p.done_recent)]),
          }}
        >
          <StackedRows
            format={count}
            keys={WORK_KEYS}
            rows={people.map((p, i) => ({
              key: p.user_id || 'nobody',
              label: personLabel(names, p.user_id, i),
              parts: { todo: p.todo, in_progress: p.in_progress, in_review: p.in_review, blocked: p.blocked },
              overdue: p.overdue,
              done: p.done_recent,
              avatar: <span className={`mini-avatar${p.user_id ? '' : ' none'}`}>{p.user_id ? (knownName(names, p.user_id)?.[0] ?? i + 1) : '?'}</span>,
            }))}
            aside={[
              { label: 'Late', render: (r) => (r.overdue ? <span className="flag bad">▲ {count(r.overdue)}</span> : <span className="muted">—</span>) },
              { label: 'Done', render: (r) => (r.done ? <span className="flag good">✓ {count(r.done)}</span> : <span className="muted">—</span>) },
            ]}
          />
        </ChartCard>
      )}
      {tasks && (
        <ChartCard
          title="Task board"
          subtitle={`${count(tasks.open)} open · ${count(tasks.due_next_7_days)} due this week · ${count(tasks.unassigned)} waiting for someone`}
          legend={columns.map((c, i) => ({ label: c.label || label(c.key), color: c.key === 'done' ? '#a29d8f' : SERIES[i] }))}
          table={{ columns: ['Column', 'Tasks'], rows: columns.map((c) => [c.label || label(c.key), count(c.count)]) }}
        >
          <SegmentedBar
            format={count}
            label="Tasks"
            parts={columns.map((c, i) => ({ label: c.key === 'done' ? `Done (last ${tasks.done_within_days} days)` : c.label, value: c.count, color: c.key === 'done' ? '#a29d8f' : SERIES[i], ink: c.key === 'blocked' ? '#0b0b0b' : '#fff' }))}
          />
          <div className="mini-head">Created and completed each week</div>
          <LineChart
            height={170}
            format={count}
            categories={tasks.weekly.map((w) => {
              const d = new Date(`${w.week_start}T00:00:00`)
              return { key: w.week_start, label: dayShort.format(d), title: `Week of ${dayShort.format(d)}` }
            })}
            series={[
              { key: 'created', label: 'Created', color: SERIES[0], values: tasks.weekly.map((w) => w.created) },
              { key: 'completed', label: 'Completed', color: SERIES[1], values: tasks.weekly.map((w) => w.completed) },
            ]}
          />
          <ul className="chart-legend inline">
            <li><span className="legend-key line" style={{ background: SERIES[0] }} />Created</li>
            <li><span className="legend-key line" style={{ background: SERIES[1] }} />Completed</li>
          </ul>
        </ChartCard>
      )}
      {projects && (
        <ChartCard
          title="Projects"
          subtitle={`${count(projects.running)} running · ${projects.average_progress_pct}% done on average`}
          action={<Link className="link-btn" to="/projects">Projects</Link>}
          table={{
            columns: ['Health or status', 'Projects'],
            rows: [...projects.by_health.map((h) => [`Health: ${HEALTH[h.key]?.label || h.key}`, count(h.count)]), ...projects.by_status.map((s) => [label(s.key), count(s.count)])],
          }}
        >
          <div className="health-row">
            {projects.by_health.map((h) => {
              const meta = HEALTH[h.key] || HEALTH.unknown
              return (
                <div key={h.key} className="health-chip">
                  <span className="health-icon" style={{ color: meta.color }} aria-hidden="true">{meta.icon}</span>
                  <strong>{count(h.count)}</strong>
                  <span>{meta.label}</span>
                </div>
              )
            })}
          </div>
          {projects.needs_attention.length > 0 ? (
            <>
              <div className="mini-head">Needs attention</div>
              <ul className="attention-list">
                {projects.needs_attention.map((p) => {
                  const meta = HEALTH[p.health] || HEALTH.unknown
                  const late = p.planned_end && new Date(`${p.planned_end}T00:00:00`) < new Date()
                  return (
                    <li key={p.id}>
                      <Ring value={p.progress_pct} color={meta.color} size={36} label={`${Math.round(p.progress_pct)}% done`} />
                      <div>
                        <Link to={`/projects/${p.id}`}>{p.name}</Link>
                        <div className="muted small">
                          <span style={{ color: meta.color }} aria-hidden="true">{meta.icon}</span> {meta.label} · {Math.round(p.progress_pct)}% done
                          {late && ` · ended ${dayShort.format(new Date(`${p.planned_end}T00:00:00`))}`}
                          {knownName(names, p.manager_user_id) && ` · ${knownName(names, p.manager_user_id)}`}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="chart-empty">No project needs attention.</p>
          )}
        </ChartCard>
      )}
    </>
  )
}

// ---------- People ----------
function PeopleCards({ q, names }) {
  const people = q.workforce.data
  const util = q.utilization.data
  if (!people && !util) return null
  const att = people?.attendance_today
  const attParts = (att?.by_status ?? []).map((b, i) => ({ label: label(b.key), value: b.count, color: SERIES[i % SERIES.length] }))
  if (att?.not_marked) attParts.push({ label: 'Not marked', value: att.not_marked, color: '#d4cec0', ink: '#3c392f' })
  const utilRows = (util?.data ?? [])
    .map((r, i) => ({ key: r.resource_id, label: r.user?.name || personLabel(names, r.user?.id, i), value: num(r.total_pct ?? r.planned_pct) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  return (
    <>
      {people && (
        <ChartCard
          title="People"
          subtitle={`${count(people.headcount)} on the payroll`}
          action={<Link className="link-btn" to="/users">People</Link>}
          table={{
            columns: ['Group', 'People'],
            rows: [
              ...people.by_unit.map((u) => [u.unit_id ? names.unitName(u.unit_id) : 'No department', count(u.count)]),
              ...people.by_employment_type.map((t) => [label(t.key), count(t.count)]),
            ],
          }}
        >
          <div className="mini-head">By department</div>
          <BarList
            format={count}
            rows={people.by_unit.slice(0, 8).map((u) => ({ key: u.unit_id || 'none', label: u.unit_id ? names.unitName(u.unit_id) : 'No department', value: u.count, tipLabel: 'People' }))}
          />
          <div className="mini-head">Joined and left</div>
          <ColumnChart
            height={150}
            format={count}
            categories={people.moves_by_month.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: monthLong.format(monthOf(m.month)) }))}
            series={[
              { key: 'joined', label: 'Joined', color: SERIES[0], values: people.moves_by_month.map((m) => m.joined) },
              { key: 'left', label: 'Left', color: SERIES[1], values: people.moves_by_month.map((m) => m.left) },
            ]}
          />
          <ul className="chart-legend inline">
            <li><span className="legend-key" style={{ background: SERIES[0] }} />Joined</li>
            <li><span className="legend-key" style={{ background: SERIES[1] }} />Left</li>
          </ul>
        </ChartCard>
      )}
      {att && (
        <ChartCard
          title="Today"
          subtitle={`${count(att.expected)} expected at work${att.late ? ` · ${count(att.late)} came in late` : ''}`}
          legend={attParts.map((p) => ({ label: p.label, color: p.color }))}
          action={<Link className="link-btn" to="/people/attendance">Attendance</Link>}
          table={{ columns: ['Attendance', 'People'], rows: attParts.map((p) => [p.label, count(p.value)]) }}
        >
          <SegmentedBar parts={attParts} format={count} label="Attendance today" />
          {people.leave && (
            <div className="stat-trio">
              <Link to="/people/leaves">
                <strong>{count(people.leave.pending_requests)}</strong>
                <span>leave requests to decide</span>
              </Link>
              <div>
                <strong>{count(people.leave.on_leave_today)}</strong>
                <span>on leave today</span>
              </div>
              <div>
                <strong>{count(people.leave.starting_next_7_days)}</strong>
                <span>leaves starting this week</span>
              </div>
            </div>
          )}
        </ChartCard>
      )}
      {util && utilRows.length > 0 && (
        <ChartCard
          title="How busy people are"
          subtitle={`This month · ${util.actuals_available ? 'time recorded' : 'time planned (recorded time not available)'} against working hours`}
          action={<Link className="link-btn" to="/capacity">Capacity</Link>}
          table={{ columns: ['Person', 'Busy'], rows: utilRows.map((r) => [r.label, `${Math.round(r.value)}%`]) }}
        >
          <BarList format={(v) => `${Math.round(v)}%`} rows={utilRows.map((r) => ({ ...r, tipLabel: 'Of working hours' }))} />
        </ChartCard>
      )}
    </>
  )
}

