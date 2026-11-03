import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ceoApi } from '@/features/ceo/api.js'
import { change, count, HEALTH_TEXT, label, money, num, periodFor, RANGES, REASON_TEXT } from '@/features/ceo/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useTaxEntries } from '@/features/tax/useTaxConfig.js'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import { BarList, ChartCard, ColumnChart, SERIES, STATUS, useCountUp } from '@/shared/components/Charts.jsx'
import { Row, Section } from '@/shared/components/DashboardGrid.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayLong = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const dayOf = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const HEALTH_COLOR = { excellent: STATUS.good, good: STATUS.good, needs_attention: STATUS.warning, critical: STATUS.critical }

// Every company on one screen. The gateway adds the companies up and leaves out what the person
// may not see; a card it could not fill says why instead of showing zero.
export default function CommandCenter() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const [range, setRange] = useState('this_month')
  const period = periodFor(range)
  const query = useQuery(
    ['ceo-summary', user?.client_id ?? user?.organization?.id, range, period.from],
    ({ signal }) => ceoApi.screen(period, { signal }),
    { keepPrevious: true }
  )
  const names = useNames(orgId)
  const screen = query.data
  const busy = query.refreshing || query.fetching

  return (
    <div className={`ceo${busy ? ' is-refetching' : ''}`}>
      <div className="page-head">
        <div>
          <h1>CEO Command Center</h1>
          <p className="muted" style={{ margin: 0 }}>
            {screen
              ? `${screen.organizations.length === 1 ? screen.organizations[0].name : `${screen.organizations.length} companies`} · ${dayLong.format(dayOf(screen.period.from_date))} – ${dayLong.format(dayOf(screen.period.to_date))}, compared with the same number of days before`
              : 'Every company on one screen'}
          </p>
        </div>
      </div>

      <div className="overview-filters">
        <div className="segmented" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={range === r.key ? 'active' : ''} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn secondary small-btn" onClick={query.reload} aria-busy={busy}>
          Refresh
        </button>
      </div>

      {query.error && !screen && <ErrorBanner error={query.error} onRetry={query.reload} />}
      {query.loading && !screen && <PanelSkeleton panels={4} />}
      {screen && <Screen screen={screen} names={names} />}
    </div>
  )
}

// Names for the ids revenue keeps (verticals, places of supply), from the active company's lookups.
function useNames(orgId) {
  const verticals = useLookup(['verticals', orgId, 'all'], ({ signal }) => ceoApi.verticals(orgId, { signal }), { enabled: Boolean(orgId) })
  const { entries: places } = useTaxEntries(orgId, 'jurisdiction')
  return {
    vertical: (id) => (id === 'none' ? 'No vertical' : (verticals.data ?? []).find((v) => v.id === id)?.name ?? 'Other vertical'),
    place: (code) => {
      const name = places.find((p) => p.code === code)?.data?.name
      return name ? `${name} (${code})` : code
    },
  }
}

function Screen({ screen, names }) {
  const cur = screen.currency
  const fmt = (v) => money(v, cur)
  return (
    <>
      {screen.mixed_currencies && (
        <div className="alert warn">Some records use another currency; their amounts are added as they are, in {cur}.</div>
      )}
      <Headlines kpis={screen.kpis} fmt={fmt} />

      <Section title="Revenue" sub="Issued invoices net of tax; credit notes taken off">
        <Row spans={[7, 5]}>
          <Card key="trend" title="Revenue by month" state={screen.revenue} to="/invoices"
            table={{ columns: ['Month', 'Revenue'], rows: screen.revenue.by_month.map((m) => [monthLong.format(monthOf(m.month)), money(m.amount, cur, false)]) }}>
            <ColumnChart height="fill" format={fmt}
              categories={screen.revenue.by_month.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: monthLong.format(monthOf(m.month)) }))}
              series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0], values: screen.revenue.by_month.map((m) => num(m.amount)) }]} />
          </Card>
          <BucketCard key="vertical" title="Revenue by business line" subtitle="By the vertical of what was billed" state={screen.revenue}
            rows={screen.revenue.by_vertical} name={names.vertical} fmt={fmt} to="/offerings" />
        </Row>
        <Row spans={[7, 5]}>
          <CompaniesCard key="companies" section={screen.companies} fmt={fmt} />
          <BucketCard key="state" title="Revenue by state" subtitle="By the invoice's place of supply" state={screen.revenue}
            rows={screen.revenue.by_state} name={names.place} fmt={fmt} to="/invoices" />
        </Row>
        <Row spans={[4, 4, 4]}>
          <BucketCard key="client-type" title="By customer type" state={screen.revenue} rows={screen.revenue.by_client_type} name={label} fmt={fmt} to="/customers" />
          <BucketCard key="contract-type" title="By contract type" state={screen.revenue} rows={screen.revenue.by_contract_type} name={label} fmt={fmt} to="/contracts" />
          <AmcCard key="amc" section={screen.revenue} fmt={fmt} />
        </Row>
      </Section>

      <Section title="Costs" sub={screen.can_see_financials ? 'What FBOS records as spend so far' : undefined}>
        <Row spans={[6, 6]}>
          <ExpensesCard key="expenses" section={screen.expenses} fmt={fmt} />
          <BudgetCard key="budget" section={screen.budget} fmt={fmt} />
        </Row>
        <Row spans={[6, 6]}>
          <BucketCard key="project-costs" title="Project costs by category" subtitle="Cost entries on projects, subcontracting included"
            state={screen.delivery.costs_by_category ? screen.delivery : { available: false, reason: 'no_access' }}
            rows={screen.delivery.costs_by_category ?? []} name={label} fmt={fmt} to="/projects" />
          <BucketCard key="assets" title="Software & assets" subtitle={screen.asset_costs.available ? `${fmt(screen.asset_costs.subscriptions_monthly)} a month in ${count(screen.asset_costs.active_subscriptions)} subscriptions` : undefined}
            state={screen.asset_costs} rows={screen.asset_costs.by_family ?? []} name={label} fmt={fmt} to="/assets" />
        </Row>
      </Section>

      <Section title="Operations">
        <Row spans={[6, 6]}>
          <ProcurementCard key="procurement" section={screen.procurement} fmt={fmt} />
          <FieldCard key="field" field={screen.field} procurement={screen.procurement} people={screen.people} />
        </Row>
        <Row spans={[6, 6]}>
          <PeopleCard key="people" section={screen.people} fmt={fmt} />
          <ProjectsCard key="projects" section={screen.delivery} health={screen.health} />
        </Row>
      </Section>

      <Section title="Needs attention">
        <Alerts alerts={screen.alerts} fmt={fmt} />
      </Section>
    </>
  )
}

// ---------- Headline numbers ----------
function Headlines({ kpis, fmt }) {
  const tiles = [
    { key: 'revenue', title: 'Total revenue', metric: kpis.total_revenue, format: fmt, to: '/invoices' },
    { key: 'expenses', title: 'Total expenses', metric: kpis.total_expenses, format: fmt, to: '/budgets', higherIsBetter: false, note: 'Recorded so far' },
    { key: 'profit', title: 'Total profit', metric: kpis.total_profit, format: fmt },
    { key: 'pipeline', title: 'Sales pipeline', metric: kpis.sales_pipeline, format: fmt, to: '/opportunities', note: 'Open opportunities' },
    { key: 'receivables', title: 'Receivables', metric: kpis.receivables, format: fmt, to: '/collections', note: 'Owed to you today' },
    { key: 'projects', title: 'Active projects', metric: kpis.active_work_units, format: count, to: '/projects', note: 'Planned, active or on hold' },
    { key: 'clients', title: 'Total clients', metric: kpis.total_clients, format: count, to: '/customers' },
    { key: 'employees', title: 'Employees', metric: kpis.total_employees, format: count, to: '/users' },
    { key: 'health', title: 'Business health', metric: kpis.business_health, format: (v) => `${Math.round(v)}%`, to: '/scorecard', health: true },
  ]
  return (
    <div className="kpi-row">
      {tiles.map(({ key, ...tile }) => (
        <Kpi key={key} {...tile} />
      ))}
    </div>
  )
}

function Kpi({ title, metric, format, to, note, higherIsBetter = true, health = false }) {
  const shown = useCountUp(num(metric.value?.amount))
  const unavailable = !metric.available || !metric.value
  const delta = unavailable ? null : change(metric.value.amount, metric.value.previous, { higherIsBetter })
  let sub = note
  let tone = ''
  if (unavailable) {
    sub = health && metric.reason === 'not_set_up' ? 'Set up your scorecard' : REASON_TEXT[metric.reason] ?? REASON_TEXT.unavailable
  } else if (health) {
    sub = HEALTH_TEXT[metric.label] ?? note
    tone = metric.label === 'excellent' || metric.label === 'good' ? 'good' : 'bad'
  } else if (delta) {
    sub = delta.text
    tone = delta.tone
  }
  if (!unavailable && metric.organizations_missing > 0) sub = `${sub ?? ''}${sub ? ' · ' : ''}${metric.organizations_missing} not included`
  const body = (
    <>
      <div className="kpi-label">{title}</div>
      <div className={`kpi-value${unavailable ? ' muted' : ''}`}>{unavailable ? '—' : format(shown)}</div>
      {sub && <div className={`kpi-sub${tone ? ` ${tone}` : ''}`}>{sub}</div>}
    </>
  )
  return to && !unavailable ? <Link to={to} className="kpi">{body}</Link> : <div className="kpi">{body}</div>
}

// ---------- Cards ----------
// A chart card, or the reason it has nothing to show; a card links to the page it comes from.
function Card({ title, subtitle, state, to, table, legend, children }) {
  const action = to && state.available ? <Link to={to} className="small">Open</Link> : null
  const missing = state.available && state.organizations_missing > 0 ? `${state.organizations_missing} compan${state.organizations_missing === 1 ? 'y' : 'ies'} not included` : null
  return (
    <ChartCard title={title} subtitle={[subtitle, missing].filter(Boolean).join(' · ') || undefined} action={action}
      table={state.available ? table : undefined} legend={state.available ? legend : undefined}>
      {state.available ? children : <p className="chart-empty">{reasonText(state.reason)}</p>}
    </ChartCard>
  )
}

function reasonText(reason) {
  if (reason === 'no_access') return 'You don’t have access to these figures. Your administrator can grant it.'
  if (reason === 'not_set_up') return 'Not set up yet.'
  return 'These figures can’t be loaded right now. Try Refresh in a moment.'
}

function BucketCard({ title, subtitle, state, rows, name, fmt, to }) {
  return (
    <Card title={title} subtitle={subtitle} state={state} to={to}
      table={{ columns: ['', 'Amount'], rows: rows.map((r) => [name(r.key), fmt(r.amount)]) }}>
      <BarList fill format={fmt} rows={rows.slice(0, 8).map((r) => ({ key: r.key, label: name(r.key), value: num(r.amount) }))} />
    </Card>
  )
}

function CompaniesCard({ section, fmt }) {
  const rows = section.rows ?? []
  return (
    <Card title="Business by company" subtitle="Revenue in the period, each company of the account" state={section} to="/organizations"
      table={{
        columns: ['Company', 'Revenue', 'Change', 'Receivables', 'Projects', 'People'],
        rows: rows.map((r) => [
          r.name,
          r.revenue ? fmt(r.revenue.amount) : '—',
          r.revenue ? change(r.revenue.amount, r.revenue.previous)?.text ?? '' : '',
          r.receivables === null ? '—' : fmt(r.receivables),
          r.active_projects ?? '—',
          r.headcount ?? '—',
        ]),
      }}>
      <BarList fill format={fmt} emptyText="No revenue in this period."
        rows={rows.filter((r) => r.revenue).map((r) => ({
          key: r.organization_id,
          label: r.name,
          value: num(r.revenue.amount),
          sub: [r.active_projects !== null && `${count(r.active_projects)} projects`, r.headcount !== null && `${count(r.headcount)} people`].filter(Boolean).join(' · '),
        }))} />
    </Card>
  )
}

function Facts({ items }) {
  return (
    <dl className="ceo-facts">
      {items.filter(Boolean).map(([term, value, tone]) => (
        <div key={term} className={tone ? `ceo-fact ${tone}` : 'ceo-fact'}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AmcCard({ section, fmt }) {
  const amc = section.amc
  return (
    <Card title="AMC & services" state={section} to="/contracts">
      {amc && (
        <Facts items={[
          ['Active AMC contracts', count(amc.active_contracts)],
          ['Contract value', fmt(amc.active_value)],
          ['Customers on AMC', count(amc.clients)],
          ['Renewals due in 30 days', count(amc.renewals_due), amc.renewals_due > 0 ? 'warn' : ''],
          ['AMC revenue this period', fmt(amc.revenue)],
        ]} />
      )}
    </Card>
  )
}

function ExpensesCard({ section, fmt }) {
  const parts = (section.components ?? []).filter((c) => c.available)
  const missing = (section.components ?? []).filter((c) => !c.available).map((c) => label(c.key))
  const subtitle = section.available
    ? `Office, travel and other operating expenses are not recorded in FBOS yet${missing.length ? ` · not available: ${missing.join(', ')}` : ''}`
    : undefined
  return (
    <Card title="Where the money goes" subtitle={subtitle} state={section} to="/budgets"
      table={{ columns: ['', 'This period', 'Previous'], rows: parts.map((c) => [label(c.key), fmt(c.amount.amount), fmt(c.amount.previous)]) }}>
      <BarList fill format={fmt} rows={parts.map((c) => ({ key: c.key, label: label(c.key), value: num(c.amount.amount), sub: change(c.amount.amount, c.amount.previous, { higherIsBetter: false })?.text }))} />
    </Card>
  )
}

function BudgetCard({ section, fmt }) {
  return (
    <Card title="Budget vs actual" subtitle="This financial year, every company's budgets" state={section} to="/budgets">
      <Facts items={[
        ['Approved', fmt(section.approved)],
        ['Spent', fmt(section.actual)],
        section.used_pct !== null && ['Used', `${section.used_pct}%`, section.used_pct > 100 ? 'bad' : section.used_pct > 85 ? 'warn' : 'good'],
      ]} />
    </Card>
  )
}

function ProcurementCard({ section, fmt }) {
  const statuses = section.by_status ?? []
  return (
    <Card title="Procurement & purchase" subtitle="Purchase orders dated in the period" state={section} to="/inventory/purchase-orders"
      table={{ columns: ['Status', 'Orders', 'Value'], rows: statuses.map((s) => [label(s.status), count(s.count), s.total === null ? '—' : fmt(s.total)]) }}>
      <Facts items={[
        section.committed && ['Committed spend', fmt(section.committed.amount)],
        section.committed && change(section.committed.amount, section.committed.previous, { higherIsBetter: false }) && [
          'Against previous period', change(section.committed.amount, section.committed.previous, { higherIsBetter: false }).text,
        ],
        ['Approved orders', count(section.committed_count)],
        ['Goods received', count(section.goods_receipts)],
      ]} />
      {section.by_category && section.by_category.length > 0 && (
        <BarList format={fmt} rows={section.by_category.slice(0, 5).map((c) => ({ key: c.key, label: c.key, value: num(c.amount) }))} />
      )}
    </Card>
  )
}

function FieldCard({ field, procurement, people }) {
  return (
    <Card title="Hardware & field team" state={field} to="/inventory/issues">
      <Facts items={[
        ['Technicians', count(field.technicians)],
        ['Available now', count(field.technicians_available)],
        people.available && ['On leave today (everyone)', count(people.on_leave_today)],
        procurement.available && ['Devices installed this period', count(procurement.installations)],
        procurement.available && ['New installations', count(procurement.new_installs)],
        ['Open repairs', count(field.open_repairs), field.open_repairs > 0 ? 'warn' : ''],
      ]} />
    </Card>
  )
}

function PeopleCard({ section, fmt }) {
  return (
    <Card title="People" subtitle={section.available ? `${count(section.headcount)} employed · ${count(section.on_leave_today)} on leave today` : undefined}
      state={section} to="/users"
      table={{ columns: ['Employment type', 'People'], rows: (section.by_employment_type ?? []).map((b) => [label(b.key), count(b.count)]) }}>
      {section.payroll && (
        <Facts items={[
          ['Payroll this period', fmt(section.payroll.amount)],
          change(section.payroll.amount, section.payroll.previous, { higherIsBetter: false }) && [
            'Against previous period', change(section.payroll.amount, section.payroll.previous, { higherIsBetter: false }).text,
          ],
        ]} />
      )}
      <BarList format={count} rows={(section.by_employment_type ?? []).map((b) => ({ key: b.key, label: label(b.key), value: b.count }))} />
    </Card>
  )
}

function ProjectsCard({ section, health }) {
  return (
    <Card title="Projects & scorecard" state={section} to="/projects">
      <Facts items={[
        ['Running', count(section.running)],
        ['At risk', count(section.at_risk), section.at_risk > 0 ? 'warn' : ''],
        ['Past their end date', count(section.late), section.late > 0 ? 'bad' : ''],
        health.available && [
          `Business health${health.by_company.length > 1 ? ' (average company)' : ''}`,
          <span key="h" style={{ color: HEALTH_COLOR[health.label] }}>{`${Math.round(health.score_pct)}% · ${HEALTH_TEXT[health.label]}`}</span>,
        ],
        health.available && ['KPIs on track / at risk / off track', `${health.on_track} / ${health.at_risk} / ${health.off_track}`],
      ]} />
    </Card>
  )
}

// ---------- Needs attention ----------
function Alerts({ alerts, fmt }) {
  const items = [
    alerts.approvals_pending > 0 && { key: 'approvals', text: `${alerts.approvals_pending}${alerts.approvals_more ? '+' : ''} approvals waiting`, to: '/' },
    alerts.overdue_receivables > 0 && { key: 'overdue', text: `${fmt(alerts.overdue_receivables)} overdue from customers`, to: '/collections' },
    alerts.at_risk_projects > 0 && { key: 'risk', text: `${alerts.at_risk_projects} projects at risk of delay`, to: '/projects' },
    alerts.renewals_due > 0 && { key: 'renewals', text: `${alerts.renewals_due} AMC renewals due in 30 days`, to: '/contracts' },
    alerts.open_repairs > 0 && { key: 'repairs', text: `${alerts.open_repairs} devices out for repair`, to: '/inventory/repairs' },
  ].filter(Boolean)
  const unknown = [alerts.approvals_pending, alerts.overdue_receivables, alerts.at_risk_projects].every((v) => v === null)
  if (!items.length) {
    return <p className="panel muted">{unknown ? 'Nothing to show: these figures aren’t available to you.' : 'Nothing needs your attention right now.'}</p>
  }
  return (
    <ul className="panel ceo-alerts">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to}>{item.text}</Link>
        </li>
      ))}
    </ul>
  )
}
