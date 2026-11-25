import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { overviewApi } from '@/features/dashboard/api.js'
import useDepartment from '@/features/dashboard/useDepartment.js'
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
import { Row, Section } from '@/shared/components/DashboardGrid.jsx'
import '@/features/dashboard/dashboard.css'
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
  planned: 'Planned', on_hold: 'On hold', completed: 'Completed', closed: 'Closed',
  active: 'Active', probation: 'Probation', on_leave: 'On leave', noticed: 'Serving notice', exited: 'Left',
  present: 'Present', half_day: 'Half day', regularized: 'Regularized', absent: 'Absent', holiday: 'Holiday',
  full_time: 'Full time', part_time: 'Part time', contractor: 'Contractor', intern: 'Intern', freelancer: 'Freelancer',
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
  unknown: { label: 'Not assessed', color: '#94a3b8', icon: '○' },
}
const WINDOWS = [3, 6, 12]

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- Data: one query per service summary the user may read ----------
function useOverview(orgId, months, taskUnitId) {
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
    tasks: useQuery(['overview', orgId, 'tasks', weeks, ...(taskUnitId ? [taskUnitId] : [])], (o) => overviewApi.tasks(orgId, weeks, o, taskUnitId), opts(ACCESS.tasks)),
    projects: useQuery(['overview', orgId, 'projects'], (o) => overviewApi.projects(orgId, o), opts(ACCESS.projects)),
    workforce: useQuery(['overview', orgId, 'workforce', months], (o) => overviewApi.workforce(orgId, months, o), opts(ACCESS.people)),
    utilization: useQuery(['overview', orgId, 'utilization', from], (o) => overviewApi.utilization(orgId, from, to, o), opts(ACCESS.capacity)),
  }
}

// ---------- The overview ----------
export default function Overview() {
  const { orgId, activeOrg } = useActiveOrg()
  const [months, setMonths] = useState(6)
  // A person in a department sees that department's numbers first (Sales: pipeline; Development,
  // Digital Marketing and the like: their team's tasks and projects; HR: people), and can switch
  // to the whole company. Someone in no department keeps the whole-company view.
  const { user: viewer } = useAuth()
  const dept = useDepartment(orgId)
  // Whoever runs the company (admin, CEO view, task setup) starts on the whole company; the
  // department's view is one click away. Everyone else starts on their own department.
  const runsCompany = hasAccess(viewer, ACCESS.deliverySetup) || hasAccess(viewer, ACCESS.ceoDashboard)
  const [scope, setScope] = useState(runsCompany ? 'company' : 'team')
  const focus = dept && scope === 'team' ? dept.kind : null
  const q = useOverview(orgId, months, focus ? dept.unit.id : null)
  const names = useDeliveryNames(orgId)
  const queries = Object.values(q).filter((x) => x.loading || x.data || x.error)
  if (queries.length === 0) return null // nothing here this person may read

  const refreshing = queries.some((x) => x.refreshing || x.fetching)
  const failed = Object.entries(q).filter(([, x]) => x.error && !x.data)
  const reloadAll = () => queries.forEach((x) => x.reload())

  return (
    <section className={`overview${refreshing ? ' is-refetching' : ''}`} aria-label="Company overview">
      <div className="home-section-head overview-head">
        <h2>How {focus ? dept.unit.name : activeOrg?.name || 'the company'} is doing</h2>
        <span>{focus ? 'Your department first. Switch to see the whole company.' : 'Live from sales, billing, delivery and people'}</span>
      </div>

      <div className="overview-filters">
        <OrgSwitcher />
        {dept && (
          <div className="segmented" role="group" aria-label="What to show">
            <button type="button" className={scope === 'team' ? 'active' : ''} aria-pressed={scope === 'team'} onClick={() => setScope('team')}>
              {dept.unit.name}
            </button>
            <button type="button" className={scope === 'company' ? 'active' : ''} aria-pressed={scope === 'company'} onClick={() => setScope('company')}>
              Whole company
            </button>
          </div>
        )}
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

      <Headlines q={q} only={HEADLINES_FOR[focus]} />
      {(!focus || focus === 'sales') && <FlowStrip q={q} />}

      {(!focus || focus === 'sales') && <SalesSection q={q} names={names} />}
      {!focus && <MoneySection q={q} />}
      {focus !== 'people' && <WorkSection q={q} names={names} />}
      {(!focus || focus === 'people') && <PeopleSection q={q} names={names} />}
    </section>
  )
}

// ---------- Headline numbers ----------
// A line-drawn icon and a colour for each headline tile.
const TILE_ICONS = {
  pipeline: ['M3 4h18l-7 8v6l-4 2v-8z', '#7c3aed'],
  outstanding: ['M3 7h18v12H3zM3 11h18M7 15h3', '#ea580c'],
  collected: ['M4 20V10m6 10V4m6 16v-7m4 7H2', '#16a34a'],
  tasks: ['M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9', '#2563eb'],
  projects: ['M9 3h6v3H9zM6 5h12v16H6zM9 11h6M9 15h6', '#0891b2'],
  people: ['M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-7 8-7s8 3 8 7', '#6366f1'],
}

function Kpi({ icon, title, value, format, sub, tone, to, bar }) {
  const shown = useCountUp(num(value))
  const [path, color] = TILE_ICONS[icon] ?? TILE_ICONS.pipeline
  const body = (
    <>
      <span className="kpi-icon" style={{ '--tile': color }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
      </span>
      <div className="kpi-text">
        <div className="kpi-label">{title}</div>
        <div className="kpi-value">{format(shown)}</div>
        {sub && <div className={`kpi-sub${tone ? ` ${tone}` : ''}`}>{sub}</div>}
        {bar && bar.max > 0 && (
          <span className={`kpi-bar${bar.bad ? ' bad' : ''}`} role="meter" aria-label={`${title}: ${bar.label}`} aria-valuemin={0} aria-valuemax={bar.max} aria-valuenow={bar.value}>
            <span style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%` }} />
          </span>
        )}
      </div>
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

// The tiles each department's view keeps; no focus keeps them all.
const HEADLINES_FOR = { sales: ['pipeline', 'tasks'], work: ['tasks', 'projects'], people: ['people'] }

function Headlines({ q, only }) {
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
  ].filter(Boolean).filter((t) => !only || only.includes(t.key))
  if (!tiles.length) return null
  // The share each tile's note talks about, drawn as a bar under it.
  const invoicedTotal = inv ? inv.invoiced_by_month.reduce((s, m) => s + num(m.amount.amount), 0) : 0
  const bars = {
    pipeline: opp && { value: num(opp.weighted_value.amount), max: num(opp.open_value.amount), label: 'share weighted by chance' },
    outstanding: inv && { value: num(inv.overdue.amount), max: num(inv.outstanding.amount), label: 'share that is late', bad: true },
    collected: pay && { value: num(pay.collected.amount), max: invoicedTotal, label: 'share of what was invoiced' },
    tasks: tasks && { value: num(tasks.overdue), max: num(tasks.open), label: 'share overdue', bad: true },
    projects: projects && { value: num(projects.late), max: num(projects.running), label: 'share past their end date', bad: true },
    people: people?.attendance_today && present !== undefined && { value: num(present), max: num(people.attendance_today.expected), label: 'share in today' },
  }
  return (
    <div className="kpi-row">
      {tiles.map(({ key, ...t }) => (
        <Kpi key={key} icon={key} bar={bars[key]} {...t} />
      ))}
    </div>
  )
}

// ---------- From lead to cash ----------
// Each step a shade darker, from the first enquiry to the cash in hand.
const FLOW_COLORS = ['#0e7ec4', '#0c6fb8', '#0a5fab', '#06509f', '#0242a2', '#081c2e']

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

  // Two rates and where the money stands, drawn next to the steps.
  const winRate = decided ? pct(won?.count ?? 0, decided) : null
  const collectedRate = invoiced ? Math.min(100, pct(collected, invoiced)) : null
  const owed = inv ? num(inv.outstanding.amount) : 0
  const late = inv ? Math.min(owed, num(inv.overdue.amount)) : 0
  const moneyParts = [
    { label: 'Collected', value: collected ?? 0, color: STATUS.good },
    { label: 'Owed, not yet due', value: Math.max(0, owed - late), color: SERIES[3] },
    { label: 'Late', value: late, color: STATUS.critical },
  ]
  const gauges = [
    winRate !== null && { key: 'win', label: 'Win rate', value: winRate, sub: `${count(won?.count)} won of ${count(decided)} decided`, color: SERIES[2] },
    collectedRate !== null && { key: 'collect', label: 'Collected', value: collectedRate, sub: `of ${money(invoiced, cur)} invoiced`, color: SERIES[0] },
  ].filter(Boolean)

  return (
    <section className="panel flowv" aria-label="From lead to cash">
      <div className="flowv-head">
        <h3>From lead to cash</h3>
        <span className="chart-sub">Where the business is right now, step by step</span>
      </div>
      <ol className="flowv-steps">
        {steps.map((s, i) => (
          <li key={s.key} style={{ '--i': i, '--c': FLOW_COLORS[Math.min(i, FLOW_COLORS.length - 1)] }}>
            <Link to={s.to}>
              <span className="flowv-title">{s.title}</span>
              <span className="flowv-big">{s.big}</span>
              <span className="flowv-note">{s.note}</span>
              <span className="flowv-detail">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
      {(gauges.length > 0 || (inv && moneyParts.some((p) => p.value > 0))) && (
        <div className="flowv-visuals">
          {gauges.map((g) => (
            <div key={g.key} className="flowv-gauge">
              <span className="flowv-ring">
                <Ring value={g.value} max={100} size={64} color={g.color} label={`${g.label}: ${g.value}%`} />
                <strong>{g.value}%</strong>
              </span>
              <span className="flowv-gauge-text">
                <b>{g.label}</b>
                <small>{g.sub}</small>
              </span>
            </div>
          ))}
          {inv && moneyParts.some((p) => p.value > 0) && (
            <div className="flowv-money">
              <b>Collected and owed</b>
              <SegmentedBar parts={moneyParts} format={(v) => money(v, cur)} label="Money" />
              <ul className="chart-legend">
                {moneyParts.map((p) => (
                  <li key={p.label}>
                    <span className="legend-key rect" style={{ background: p.color }} />
                    {p.label} · {money(p.value, cur)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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

const monthCats = (keys) => keys.map((k) => ({ key: k, label: monthShort.format(monthOf(k)), title: monthLong.format(monthOf(k)) }))

// ---------- Sales ----------
function SalesSection({ q, names }) {
  const opp = q.opportunities.data
  const leads = q.leads.data
  if (!opp && !leads) return null
  const stages = opp?.by_stage ?? []
  const owners = (opp?.by_owner ?? []).slice(0, 8)
  const leadParts = (leads?.by_status ?? []).map((b, i) => ({ label: label(b.key), value: b.count, color: [...SERIES, '#94a3b8'][Math.min(i, 4)] }))
  return (
    <Section title="Sales" sub={opp ? `${money(opp.open_value.amount, opp.currency)} open · ${money(opp.weighted_value.amount, opp.currency)} weighted` : undefined}>
      <Row spans={[5, 7]}>
        {opp && (
          <ChartCard
            key="pipeline"
            title="Pipeline by stage"
            subtitle="Value of the opportunities in each stage"
            table={{ columns: ['Stage', 'Deals', 'Value'], rows: stages.map((s) => [label(s.stage), count(s.count), money(s.value.amount, opp.currency, false)]) }}
          >
            <BarList
              fill
              format={(v) => money(v, opp.currency)}
              rows={stages.map((s) => ({ key: s.stage, label: label(s.stage), value: num(s.value.amount), sub: `${count(s.count)} deal${s.count === 1 ? '' : 's'}`, tipLabel: `${count(s.count)} deals` }))}
            />
          </ChartCard>
        )}
        {opp && owners.length > 0 && (
          <ChartCard
            key="sellers"
            title="Who is selling"
            subtitle={`Open pipeline and won value per owner${owners.some((o) => !knownName(names, o.user_id)) ? ` · ${HIDDEN_NAMES}` : ''}`}
            legend={[{ label: 'Open value', color: SERIES[0] }, { label: 'Won value', color: SERIES[1] }]}
            table={{
              columns: ['Owner', 'Open deals', 'Open value', 'Won', 'Won value'],
              rows: opp.by_owner.map((o, i) => [personLabel(names, o.user_id, i), count(o.open_count), money(o.open_value.amount, opp.currency, false), count(o.won_count), money(o.won_value.amount, opp.currency, false)]),
            }}
          >
            <ColumnChart
              height="fill"
              format={(v) => money(v, opp.currency)}
              categories={owners.map((o, i) => ({ key: o.user_id, label: initialsOf(personLabel(names, o.user_id, i)), title: personLabel(names, o.user_id, i) }))}
              series={[
                { key: 'open', label: 'Open value', color: SERIES[0], values: owners.map((o) => num(o.open_value.amount)) },
                { key: 'won', label: 'Won value', color: SERIES[1], values: owners.map((o) => num(o.won_value.amount)) },
              ]}
            />
          </ChartCard>
        )}
      </Row>
      {leads && (
        <Row spans={[5, 7]}>
          <ChartCard
            key="leads"
            title="Leads"
            subtitle={`${count(leads.total)} in all · where they stand and where they came from`}
            legend={leadParts.map((p) => ({ label: p.label, color: p.color }))}
            table={{
              columns: ['Status or source', 'Leads'],
              rows: [...leads.by_status.map((b) => [label(b.key), count(b.count)]), ...leads.by_source.map((b) => [`Source: ${label(b.key)}`, count(b.count)])],
            }}
          >
            <SegmentedBar parts={leadParts} format={count} label="Leads" />
            <div className="mini-head">Where they came from</div>
            <BarList fill format={count} rows={leads.by_source.slice(0, 5).map((b) => ({ key: b.key, label: label(b.key), value: b.count, tipLabel: 'Leads' }))} />
          </ChartCard>
          <ChartCard
            key="new-leads"
            title="New leads per month"
            subtitle={`${count(leads.created_by_month.reduce((s, m) => s + m.count, 0))} in the last ${leads.created_by_month.length} months`}
            table={{ columns: ['Month', 'New leads'], rows: leads.created_by_month.map((m) => [monthLong.format(monthOf(m.key)), count(m.count)]) }}
          >
            <ColumnChart
              height="fill"
              format={count}
              categories={monthCats(leads.created_by_month.map((m) => m.key))}
              series={[{ key: 'new', label: 'New leads', color: SERIES[0], values: leads.created_by_month.map((m) => m.count) }]}
            />
          </ChartCard>
        </Row>
      )}
    </Section>
  )
}

function initialsOf(name) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

// ---------- Money ----------
function MoneySection({ q }) {
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
    <Section title="Money" sub={inv ? `${money(inv.outstanding.amount, cur)} owed · ${money(inv.overdue.amount, cur)} past due` : undefined}>
      <Row spans={[7, 5]}>
        <ChartCard
          key="flow"
          title={series.length > 1 ? 'Invoiced and collected' : series[0].label}
          subtitle={`Per month${mixed ? ' · some records use other currencies and are added as they are' : ''}`}
          legend={series.length > 1 ? series.map((s) => ({ label: s.label, color: s.color })) : undefined}
          table={{ columns: ['Month', ...series.map((s) => s.label)], rows: months.map((k, i) => [monthLong.format(monthOf(k)), ...series.map((s) => money(s.values[i], cur, false))]) }}
        >
          <ColumnChart height="fill" format={(v) => money(v, cur)} categories={monthCats(months)} series={series} />
        </ChartCard>
        {inv && (
          <ChartCard
            key="aging"
            title="How late is the money owed"
            subtitle="Money still owed, by how long past its due date"
            table={{ columns: ['Age', 'Invoices', 'Owed'], rows: inv.aging.map((a) => [label(a.key), count(a.count), money(a.amount.amount, cur, false)]) }}
            action={<Link className="link-btn" to="/collections">Collections</Link>}
          >
            <BarList
              fill
              format={(v) => money(v, cur)}
              colors={ORDINAL}
              rows={inv.aging.map((a) => ({ key: a.key, label: label(a.key), value: num(a.amount.amount), sub: `${count(a.count)} inv.`, tipLabel: `${count(a.count)} invoices` }))}
            />
          </ChartCard>
        )}
      </Row>
      {inv && (
        <Row spans={[7, 5]}>
          <ChartCard
            key="status"
            title="Invoices by status"
            subtitle="How many in each status, and what they are worth"
            table={{ columns: ['Status', 'Invoices', 'Total', 'Still owed'], rows: inv.by_status.map((s) => [label(s.status), count(s.count), money(s.total.amount, cur, false), money(s.balance.amount, cur, false)]) }}
          >
            <BarList
              fill
              format={count}
              rows={inv.by_status.map((s) => ({ key: s.status, label: label(s.status), value: s.count, sub: money(s.total.amount, cur), tipLabel: 'Invoices' }))}
            />
          </ChartCard>
          {inv.top_balances.length > 0 && (
            <ChartCard
              key="owers"
              title="Owes you the most"
              subtitle="Customers with the largest unpaid balance"
              table={{ columns: ['Customer', 'Owed'], rows: inv.top_balances.map((c) => [c.name || 'Customer', money(c.balance.amount, cur, false)]) }}
            >
              <ol className="rank-list fill">
                {inv.top_balances.map((c) => (
                  <li key={c.client_id}>
                    <Link to={`/customers/${c.client_id}`}>{c.name || 'Customer'}</Link>
                    <span>{money(c.balance.amount, cur, false)}</span>
                  </li>
                ))}
              </ol>
            </ChartCard>
          )}
        </Row>
      )}
    </Section>
  )
}

// ---------- Work ----------
function WorkSection({ q, names }) {
  const tasks = q.tasks.data
  const projects = q.projects.data
  if (!tasks && !projects) return null
  const columns = tasks?.by_column ?? []
  const people = (tasks?.people ?? []).slice(0, 12)
  const weeks = (tasks?.weekly ?? []).map((w) => {
    const d = new Date(`${w.week_start}T00:00:00`)
    return { key: w.week_start, label: dayShort.format(d), title: `Week of ${dayShort.format(d)}` }
  })
  return (
    <Section title="Work" sub={tasks ? `${count(tasks.open)} open tasks · ${count(tasks.overdue)} late` : undefined}>
      {tasks && (
        <Row>
          <ChartCard
            key="who"
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
        </Row>
      )}
      {tasks && (
        <Row spans={[5, 7]}>
          <ChartCard
            key="board"
            title="Task board"
            subtitle={`${count(tasks.due_next_7_days)} due this week · ${count(tasks.unassigned)} waiting for someone`}
            legend={columns.map((c, i) => ({ label: c.label || label(c.key), color: c.key === 'done' ? '#94a3b8' : SERIES[i] }))}
            table={{ columns: ['Column', 'Tasks'], rows: columns.map((c) => [c.label || label(c.key), count(c.count)]) }}
          >
            <SegmentedBar
              format={count}
              label="Tasks"
              parts={columns.map((c, i) => ({ label: c.key === 'done' ? `Done (last ${tasks.done_within_days} days)` : c.label, value: c.count, color: c.key === 'done' ? '#94a3b8' : SERIES[i], ink: c.key === 'blocked' ? '#0b0b0b' : '#fff' }))}
            />
            <div className="mini-head">Open tasks by priority</div>
            <BarList fill format={count} rows={(tasks.by_priority ?? []).map((p) => ({ key: p.key, label: label(p.key), value: p.count, tipLabel: 'Open tasks' }))} />
          </ChartCard>
          <ChartCard
            key="weekly"
            title="Created and completed each week"
            subtitle="When completed stays under created, the backlog grows"
            legend={[{ label: 'Created', color: SERIES[0], shape: 'line' }, { label: 'Completed', color: SERIES[1], shape: 'line' }]}
            table={{ columns: ['Week', 'Created', 'Completed'], rows: tasks.weekly.map((w, i) => [weeks[i].title, count(w.created), count(w.completed)]) }}
          >
            <LineChart
              height="fill"
              format={count}
              categories={weeks}
              series={[
                { key: 'created', label: 'Created', color: SERIES[0], values: tasks.weekly.map((w) => w.created) },
                { key: 'completed', label: 'Completed', color: SERIES[1], values: tasks.weekly.map((w) => w.completed) },
              ]}
            />
          </ChartCard>
        </Row>
      )}
      {projects && (
        <Row spans={[5, 7]}>
          <ChartCard
            key="health"
            title="Projects"
            subtitle={`${count(projects.running)} running · ${projects.average_progress_pct}% done on average · ${count(projects.late)} late`}
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
            <div className="mini-head">By status</div>
            <BarList fill format={count} rows={projects.by_status.map((s) => ({ key: s.key, label: label(s.key), value: s.count, tipLabel: 'Projects' }))} />
          </ChartCard>
          <ChartCard key="attention" title="Projects that need attention" subtitle="Off track, at risk or past their end date; worst first">
            {projects.needs_attention.length > 0 ? (
              <ul className="attention-list fill">
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
            ) : (
              <p className="chart-empty">No project needs attention.</p>
            )}
          </ChartCard>
        </Row>
      )}
    </Section>
  )
}

// ---------- People ----------
function PeopleSection({ q, names }) {
  const people = q.workforce.data
  const util = q.utilization.data
  if (!people && !util) return null
  const att = people?.attendance_today
  const attParts = (att?.by_status ?? []).map((b, i) => ({ label: label(b.key), value: b.count, color: SERIES[i % SERIES.length] }))
  if (att?.not_marked) attParts.push({ label: 'Not marked', value: att.not_marked, color: '#cbd5e1', ink: '#334155' })
  const utilRows = (util?.data ?? [])
    .map((r, i) => ({ key: r.resource_id, label: r.user?.name || personLabel(names, r.user?.id, i), value: num(r.total_pct ?? r.planned_pct) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const unitName = (id) => (id ? names.unitName(id) : 'No department')
  return (
    <Section title="People" sub={people ? `${count(people.headcount)} on the payroll` : undefined}>
      {people && (
        <Row spans={[5, 7]}>
          <ChartCard
            key="units"
            title="People by department"
            subtitle={people.by_employment_type.map((t) => `${count(t.count)} ${label(t.key).toLowerCase()}`).join(' · ')}
            action={<Link className="link-btn" to="/users">People</Link>}
            table={{
              columns: ['Group', 'People'],
              rows: [...people.by_unit.map((u) => [unitName(u.unit_id), count(u.count)]), ...people.by_employment_type.map((t) => [label(t.key), count(t.count)])],
            }}
          >
            <BarList fill format={count} rows={people.by_unit.slice(0, 7).map((u) => ({ key: u.unit_id || 'none', label: unitName(u.unit_id), value: u.count, tipLabel: 'People' }))} />
          </ChartCard>
          <ChartCard
            key="moves"
            title="Joined and left"
            subtitle="People who joined and who left, per month"
            legend={[{ label: 'Joined', color: SERIES[0] }, { label: 'Left', color: SERIES[1] }]}
            table={{ columns: ['Month', 'Joined', 'Left'], rows: people.moves_by_month.map((m) => [monthLong.format(monthOf(m.month)), count(m.joined), count(m.left)]) }}
          >
            <ColumnChart
              height="fill"
              format={count}
              categories={monthCats(people.moves_by_month.map((m) => m.month))}
              series={[
                { key: 'joined', label: 'Joined', color: SERIES[0], values: people.moves_by_month.map((m) => m.joined) },
                { key: 'left', label: 'Left', color: SERIES[1], values: people.moves_by_month.map((m) => m.left) },
              ]}
            />
          </ChartCard>
        </Row>
      )}
      <Row spans={[5, 7]}>
        {att && (
          <ChartCard
            key="today"
            title="Today"
            subtitle={`${count(att.expected)} expected at work${att.late ? ` · ${count(att.late)} came in late` : ''}`}
            legend={attParts.map((p) => ({ label: p.label, color: p.color }))}
            action={<Link className="link-btn" to="/people/attendance">Attendance</Link>}
            table={{ columns: ['Attendance', 'People'], rows: attParts.map((p) => [p.label, count(p.value)]) }}
          >
            <SegmentedBar parts={attParts} format={count} label="Attendance today" />
            {people.leave && (
              <div className="stat-trio fill">
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
            key="busy"
            title="How busy people are"
            subtitle={`This month · ${util.actuals_available ? 'time recorded' : 'time planned'} against working hours`}
            action={<Link className="link-btn" to="/capacity">Capacity</Link>}
            table={{ columns: ['Person', 'Busy'], rows: utilRows.map((r) => [r.label, `${Math.round(r.value)}%`]) }}
          >
            <BarList fill format={(v) => `${Math.round(v)}%`} rows={utilRows.map((r) => ({ ...r, tipLabel: 'Of working hours' }))} />
          </ChartCard>
        )}
      </Row>
    </Section>
  )
}
