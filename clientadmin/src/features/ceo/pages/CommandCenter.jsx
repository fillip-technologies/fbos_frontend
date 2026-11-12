import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ceoApi } from '@/features/ceo/api.js'
import { businessSegmentLabel, change, count, HEALTH_TEXT, label, money, num, periodFor, RANGES, REASON_TEXT, segmentLabel, trendTotal } from '@/features/ceo/utils.js'
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
          <TrendCard key="trend" screen={screen} fmt={fmt} />
          <BucketCard key="vertical" title="Revenue by business line" subtitle="By the vertical of what was billed" state={screen.revenue}
            rows={screen.revenue.by_vertical} name={names.vertical} fmt={fmt} to="/offerings" />
        </Row>
        <Row spans={[7, 5]}>
          <CompaniesCard key="companies" section={screen.companies} fmt={fmt} />
          <BucketCard key="state" title="Revenue by state" subtitle="By the invoice's place of supply" state={screen.revenue}
            rows={screen.revenue.by_state} name={names.place} fmt={fmt} to="/invoices" />
        </Row>
        <Row spans={[6, 6]}>
          <SegmentCard key="segment" section={screen.revenue} fmt={fmt} />
          <BucketCard key="product-line" title="Revenue by product line" subtitle="Hardware, software, services, AMC… as set on each offering"
            state={screen.revenue} rows={screen.revenue.by_product_line} name={(k) => (k === 'none' ? 'Not set on the offering' : label(k))} fmt={fmt} to="/offerings" />
        </Row>
        <Row spans={[4, 4, 4]}>
          <BucketCard key="contract-type" title="By contract type" state={screen.revenue} rows={screen.revenue.by_contract_type} name={label} fmt={fmt} to="/contracts" />
          <CustomersCard key="customers" section={screen.revenue} names={names} />
          <AmcCard key="amc" section={screen.revenue} fmt={fmt} />
        </Row>
        <Row spans={[4, 4, 4]}>
          <ProductsCard key="products" section={screen.revenue} fmt={fmt} />
          <BusinessSegmentCard key="business-segment" section={screen.revenue} fmt={fmt} />
          <ProjectsByStateCard key="projects-by-state" card={screen.revenue.projects_by_state} names={names} />
        </Row>
        <Row spans={[12]}>
          <AssociatesCard key="associates" section={screen.associates} fmt={fmt} />
        </Row>
      </Section>

      <Section title="Costs" sub={screen.can_see_financials ? 'Everything FBOS records as spend, each in one place only' : undefined}>
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
        <Row spans={[6, 6]}>
          <OperatingExpensesCard key="operating" section={screen.finance} fmt={fmt} />
          <InvestmentsCard key="investments" section={screen.finance} fmt={fmt} />
        </Row>
      </Section>

      <Section title="Operations">
        <Row spans={[6, 6]}>
          <ProcurementCard key="procurement" section={screen.procurement} fmt={fmt} />
          <FieldCard key="field" field={screen.field} procurement={screen.procurement} people={screen.people} />
        </Row>
        <Row spans={[4, 4, 4]}>
          <PeopleCard key="people" section={screen.people} fmt={fmt} />
          <FreelancersCard key="freelancers" card={screen.people.freelancer_details} />
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
    { key: 'expenses', title: 'Total expenses', metric: kpis.total_expenses, format: fmt, to: '/budgets', higherIsBetter: false, note: 'All recorded spend' },
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

// The 12 months to the period's end, from the nightly snapshots. Until those exist (or when
// Insight can't be read) the period's own months are shown, read live.
function TrendCard({ screen, fmt }) {
  const trend = screen.trend
  const months = trend?.available ? trend.months : []
  if (!months.some((m) => m.revenue !== null)) return <RevenueByMonthCard section={screen.revenue} cur={screen.currency} fmt={fmt} />
  const financials = screen.can_see_financials
  const show = (v) => (v === null || v === undefined ? 'Not recorded' : fmt(v))
  const title = (m) => `${monthLong.format(monthOf(m.month))}${m.complete ? '' : ' (partly recorded)'}`
  const series = [{ key: 'revenue', label: 'Revenue', color: SERIES[0], values: months.map((m) => m.revenue) }]
  if (financials) series.push({ key: 'expenses', label: 'Expenses', color: SERIES[1], values: months.map((m) => m.expenses) })
  const profit = trendTotal(months, 'profit')
  const partly = months.some((m) => m.revenue !== null && !m.complete)
  return (
    <Card title={financials ? 'Revenue, expenses and profit · 12 months' : 'Revenue · 12 months'} state={trend} to="/invoices"
      subtitle={`Recorded nightly up to ${dayLong.format(dayOf(trend.through))}${partly ? ' · some months only partly recorded' : ''}`}
      legend={financials ? series.map((s) => ({ label: s.label, color: s.color })) : undefined}
      table={{
        columns: financials ? ['Month', 'Revenue', 'Expenses', 'Profit'] : ['Month', 'Revenue'],
        rows: months.map((m) => [title(m), show(m.revenue), ...(financials ? [show(m.expenses), show(m.profit)] : [])]),
      }}>
      {financials && (
        <Facts items={[
          ['Revenue', show(trendTotal(months, 'revenue'))],
          ['Expenses', show(trendTotal(months, 'expenses'))],
          ['Profit', show(profit), profit !== null && profit < 0 ? 'bad' : undefined],
        ]} />
      )}
      <ColumnChart height="fill" format={show}
        categories={months.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: title(m) }))}
        series={series} />
    </Card>
  )
}

function RevenueByMonthCard({ section, cur, fmt }) {
  return (
    <Card title="Revenue by month" state={section} to="/invoices"
      table={{ columns: ['Month', 'Revenue'], rows: section.by_month.map((m) => [monthLong.format(monthOf(m.month)), money(m.amount, cur, false)]) }}>
      <ColumnChart height="fill" format={fmt}
        categories={section.by_month.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: monthLong.format(monthOf(m.month)) }))}
        series={[{ key: 'revenue', label: 'Revenue', color: SERIES[0], values: section.by_month.map((m) => num(m.amount)) }]} />
    </Card>
  )
}

function reasonText(reason) {
  if (reason === 'no_access') return 'You don’t have access to these figures. Your administrator can grant it.'
  if (reason === 'not_set_up') return 'Not set up yet.'
  return 'These figures can’t be loaded right now. Try Refresh in a moment.'
}

// A breakdown; when the gateway gives each row's previous period, the table shows it and each bar
// says how it moved.
function BucketCard({ title, subtitle, state, rows, name, fmt, to, higherIsBetter = true }) {
  const compared = rows.some((r) => r.previous !== null && r.previous !== undefined)
  return (
    <Card title={title} subtitle={subtitle} state={state} to={to}
      table={{
        columns: compared ? ['', 'This period', 'Previous'] : ['', 'Amount'],
        rows: rows.map((r) => [name(r.key), fmt(r.amount), ...(compared ? [fmt(r.previous)] : [])]),
      }}>
      <BarList fill format={fmt} rows={rows.slice(0, 8).map((r) => ({
        key: r.key,
        label: name(r.key),
        value: num(r.amount),
        sub: compared ? change(r.amount, r.previous, { higherIsBetter })?.text : undefined,
      }))} />
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
      {(section.by_relationship ?? []).length > 1 && (
        <Facts items={section.by_relationship.map((t) => [`${label(t.relationship)} · ${count(t.companies)}`, fmt(t.revenue)])} />
      )}
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
          change(amc.revenue, amc.revenue_previous) && ['Against previous period', change(amc.revenue, amc.revenue_previous).text, change(amc.revenue, amc.revenue_previous).tone],
        ]} />
      )}
    </Card>
  )
}

function ExpensesCard({ section, fmt }) {
  const parts = (section.components ?? []).filter((c) => c.available)
  const missing = (section.components ?? []).filter((c) => !c.available).map((c) => label(c.key))
  const subtitle = section.available && missing.length ? `Not included (can’t be loaded or no access): ${missing.join(', ')}` : undefined
  return (
    <Card title="Where the money goes" subtitle={subtitle} state={section} to="/budgets"
      table={{ columns: ['', 'This period', 'Previous'], rows: parts.map((c) => [label(c.key), fmt(c.amount.amount), fmt(c.amount.previous)]) }}>
      <BarList fill format={fmt} rows={parts.map((c) => ({ key: c.key, label: label(c.key), value: num(c.amount.amount), sub: change(c.amount.amount, c.amount.previous, { higherIsBetter: false })?.text }))} />
    </Card>
  )
}

// Rent, travel, marketing… recorded as expenses (approved ones, before tax).
function OperatingExpensesCard({ section, fmt }) {
  const rows = section.by_category ?? []
  const subtitle = section.available
    ? [
        section.operating_expenses && change(section.operating_expenses.amount, section.operating_expenses.previous, { higherIsBetter: false })?.text,
        section.awaiting_approval > 0 && `${count(section.awaiting_approval)} waiting for approval (${fmt(section.awaiting_approval_amount)})`,
        section.unpaid > 0 && `${fmt(section.unpaid)} not paid yet`,
      ].filter(Boolean).join(' · ') || 'Approved expenses, before tax'
    : undefined
  return (
    <Card title="Operating expenses" subtitle={subtitle} state={section} to="/expenses"
      table={{ columns: ['Category', 'Amount'], rows: rows.map((r) => [r.name, fmt(r.amount)]) }}>
      <BarList fill format={fmt} emptyText="No expenses recorded in this period."
        rows={rows.slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: num(r.amount) }))} />
    </Card>
  )
}

// Income outside sales (interest, dividends, rent) and what the companies hold today.
function InvestmentsCard({ section, fmt }) {
  const holdings = section.investments
  const income = section.other_income
  return (
    <Card title="Finance & investment income" subtitle="Income other than sales in the period; investments as held today" state={section} to="/investments"
      table={{
        columns: ['', 'Amount'],
        rows: [
          ...(section.income_by_type ?? []).map((b) => [
            `Income · ${label(b.key)}`,
            [fmt(b.amount), change(b.amount, b.previous)?.text].filter(Boolean).join(' · '),
          ]),
          ...(holdings?.by_type ?? []).map((b) => [`Invested · ${label(b.key)}`, fmt(b.amount)]),
        ],
      }}>
      <Facts items={[
        income && ['Other income', fmt(income.amount)],
        income && change(income.amount, income.previous) && ['Against previous period', change(income.amount, income.previous).text],
        holdings && ['Active investments', count(holdings.active)],
        holdings && ['Invested (principal)', fmt(holdings.principal)],
        holdings && ['Current value', fmt(holdings.current_value), holdings.current_value < holdings.principal ? 'bad' : 'good'],
        holdings && holdings.maturing_soon > 0 && ['Maturing within 30 days', count(holdings.maturing_soon), 'warn'],
      ]} />
      <BarList format={fmt} rows={(section.income_by_type ?? []).map((b) => ({
        key: `income-${b.key}`, label: label(b.key), value: num(b.amount), tipLabel: 'Income', sub: change(b.amount, b.previous)?.text,
      }))} emptyText="No other income in this period." />
      <BarList format={fmt} rows={(holdings?.by_type ?? []).map((b) => ({ key: b.key, label: label(b.key), value: num(b.amount), tipLabel: 'Invested' }))} />
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
        ...procurementBudgetFacts(section.budget, fmt),
      ]} />
      {section.by_category && section.by_category.length > 0 && (
        <BarList format={fmt} rows={section.by_category.slice(0, 5).map((c) => ({ key: c.key, label: c.key, value: num(c.amount) }))} />
      )}
    </Card>
  )
}

// Committed purchase orders against the procurement budget (the year's `procurement` budget lines
// spread over the period). Absent without the financials permission.
function procurementBudgetFacts(budget, fmt) {
  if (!budget) return []
  if (!budget.available) {
    const why = budget.reason === 'not_set_up' ? 'No procurement line in this year’s budgets' : REASON_TEXT[budget.reason] ?? REASON_TEXT.unavailable
    return [['Procurement budget', why]]
  }
  const tone = budget.over_budget > 0 ? 'bad' : budget.used_pct !== null && budget.used_pct > 85 ? 'warn' : 'good'
  return [
    ['Procurement budget for the period', fmt(budget.budget)],
    budget.used_pct !== null && ['Budget used', `${budget.used_pct}%`, tone],
    budget.over_budget > 0 && ['Over budget by', fmt(budget.over_budget), 'bad'],
  ]
}

// Today's visits and where the technicians are. Before the inventory service gives these, the
// company-wide attendance stands in, as it did.
function FieldCard({ field, procurement, people }) {
  const visits = field.visits_today
  const today = field.technicians_today
  const everyone = people.available && !today?.available
  return (
    <Card title="Hardware & field team" state={field} to="/inventory/issues">
      <Facts items={[
        ['Technicians', count(field.technicians)],
        ['Available now', count(field.technicians_available)],
        visits && ['Visits today · done', count(visits.completed)],
        visits && ['In progress / still to come', `${count(visits.in_progress)} / ${count(visits.pending)}`],
        visits && ['Late (not started after their time)', count(visits.escalated), visits.escalated > 0 ? 'bad' : ''],
        today?.available && ['Technicians in the field today', count(today.in_field)],
        today?.available && ['Technicians at the office today', count(today.at_office)],
        today?.available && ['Technicians on leave today', count(today.on_leave), today.on_leave > 0 ? 'warn' : ''],
        today?.available && today.not_marked > 0 && ['Technicians not marked in today', count(today.not_marked)],
        today?.available && today.unlinked > 0 && ['Technicians without an FBOS employee record', count(today.unlinked), 'warn'],
        today && !today.available && today.reason !== 'no_access' && ['Technicians’ attendance', REASON_TEXT[today.reason] ?? REASON_TEXT.unavailable],
        everyone && ['On the field today (everyone)', count(people.working_today?.field)],
        everyone && ['At the office today (everyone)', count(people.working_today?.office)],
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
    <Card title="People" subtitle={section.available ? `${count(section.headcount)} people · ${count(section.freelancers)} freelancers · ${count(section.on_leave_today)} on leave today` : undefined}
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
    alerts.expenses_awaiting_approval > 0 && { key: 'expenses', text: `${alerts.expenses_awaiting_approval} expenses waiting for approval`, to: '/expenses?approval_status=pending_approval' },
  ].filter(Boolean)
  const unknown = [alerts.approvals_pending, alerts.overdue_receivables, alerts.at_risk_projects].every((v) => v === null)
  if (!items.length) {
    return <p className="panel muted">{unknown ? 'Nothing to show: these figures aren’t available to you.' : 'Nothing needs your attention right now.'}</p>
  }
  return (
    <ul className="panel ceo-alerts">
      {items.map((item) => (
        <li key={item.key}>
          {item.to ? <Link to={item.to}>{item.text}</Link> : item.text}
        </li>
      ))}
    </ul>
  )
}

// ---------- B2 cards: segments, customers, associates ----------
function SegmentCard({ section, fmt }) {
  const rows = section.by_segment ?? []
  return (
    <Card title="Revenue by segment" subtitle="Government or private, in India or international" state={section} to="/customers"
      table={{ columns: ['Segment', 'Revenue'], rows: rows.map((s) => [segmentLabel(s), fmt(s.amount)]) }}>
      <BarList fill format={fmt} emptyText="No revenue in this period."
        rows={rows.map((s) => ({ key: `${s.sector}-${s.market}`, label: segmentLabel(s), value: num(s.amount) }))} />
    </Card>
  )
}

function CustomersCard({ section, names }) {
  const segments = section.clients_by_segment ?? []
  const states = (section.clients_by_state ?? []).slice(0, 6)
  return (
    <Card title="Customers" subtitle="By segment and billing state" state={section} to="/customers"
      table={{
        columns: ['', 'Customers'],
        rows: [...segments.map((s) => [segmentLabel(s), count(s.count)]), ...(section.clients_by_state ?? []).map((s) => [s.key === 'none' ? 'No state' : names.place(s.key), count(s.count)])],
      }}>
      <Facts items={segments.map((s) => [segmentLabel(s), count(s.count)])} />
      <BarList format={count} rows={states.map((s) => ({ key: s.key, label: s.key === 'none' ? 'No state' : names.place(s.key), value: s.count }))} />
    </Card>
  )
}

function AssociatesCard({ section, fmt }) {
  const rows = section.rows ?? []
  const money_ = section.revenue !== null && section.revenue !== undefined
  return (
    <Card title="Business from associates" subtitle="Projects given to associate companies: revenue on them, what we paid, and the margin"
      state={section} to="/projects"
      table={{
        columns: ['Associate', 'Projects', 'Running', 'Revenue', 'Paid to them', 'Margin'],
        rows: rows.map((r) => [r.name, count(r.projects), count(r.running), r.revenue === null ? '—' : fmt(r.revenue), r.paid === null ? '—' : fmt(r.paid), r.margin === null ? '—' : fmt(r.margin)]),
      }}>
      {rows.length === 0 ? (
        <p className="chart-empty">No projects given to associates yet. Name the associate on a project to see it here.</p>
      ) : (
        <>
          <Facts items={[
            ['Projects with associates', count(section.projects)],
            money_ && ['Revenue on them', fmt(section.revenue)],
            section.paid !== null && section.paid !== undefined && ['Paid to associates', fmt(section.paid)],
            money_ && ['Margin', fmt(section.margin), section.margin < 0 ? 'bad' : 'good'],
          ]} />
          {money_ && <BarList format={fmt} rows={rows.map((r) => ({ key: r.organization_id, label: r.name, value: num(r.margin), sub: `${count(r.projects)} projects` }))} />}
        </>
      )}
    </Card>
  )
}

// ---------- Design-gap cards: products, business segments, projects by state, freelancers ----------
function ProductsCard({ section, fmt }) {
  const products = section.top_products ?? []
  const units = section.hardware_units
  const withMoney = products.some((p) => p.revenue !== null && p.revenue !== undefined)
  const unitsChange = units ? change(units.amount, units.previous) : null
  return (
    <Card title="Hardware & top products" subtitle={withMoney ? 'Best sellers by revenue in the period' : 'Best sellers in the period, by units'}
      state={section} to="/offerings"
      table={{
        columns: withMoney ? ['Product', 'Units', 'Revenue'] : ['Product', 'Units'],
        rows: products.map((p) => [p.name, count(p.units), ...(withMoney ? [fmt(p.revenue)] : [])]),
      }}>
      {units && (
        <Facts items={[
          ['Hardware units sold', count(units.amount)],
          unitsChange && ['Against previous period', unitsChange.text, unitsChange.tone],
        ]} />
      )}
      <BarList format={withMoney ? fmt : count} emptyText="No products sold in this period."
        rows={products.slice(0, 6).map((p) => ({
          key: p.name,
          label: p.name,
          value: withMoney ? num(p.revenue) : num(p.units),
          sub: withMoney ? `${count(p.units)} units` : undefined,
        }))} />
    </Card>
  )
}

function BusinessSegmentCard({ section, fmt }) {
  const rows = section.by_business_segment ?? []
  const total = rows.reduce((sum, r) => sum + num(r.amount), 0)
  const share = (amount) => (total > 0 ? `${Math.round((num(amount) / total) * 100)}% of revenue` : undefined)
  return (
    <Card title="Revenue by business" subtitle="Each invoice line in one business: associates, AMC, hardware, then customer type"
      state={section} to="/invoices"
      table={{ columns: ['Business', 'Revenue', 'Share'], rows: rows.map((r) => [businessSegmentLabel(r.key), fmt(r.amount), share(r.amount) ?? '']) }}>
      <BarList fill format={fmt} emptyText="No revenue in this period."
        rows={rows.map((r) => ({ key: r.key, label: businessSegmentLabel(r.key), value: num(r.amount), sub: share(r.amount) }))} />
    </Card>
  )
}

function ProjectsByStateCard({ card, names }) {
  const rows = card?.rows ?? []
  const state = card ?? { available: false, reason: 'unavailable' }
  const name = (key) => (key === 'none' ? 'No customer or no state' : names.place(key))
  return (
    <Card title="Running projects by state" subtitle="By the customer’s billing state" state={state} to="/projects"
      table={{ columns: ['State', 'Projects'], rows: rows.map((r) => [name(r.key), count(r.count)]) }}>
      <BarList fill format={count} emptyText="No running projects."
        rows={rows.slice(0, 8).map((r) => ({ key: r.key, label: name(r.key), value: r.count, tipLabel: 'Projects' }))} />
    </Card>
  )
}

function FreelancersCard({ card }) {
  const state = card ?? { available: false, reason: 'unavailable' }
  const categories = card?.top_categories ?? []
  return (
    <Card title="Freelancers" subtitle="Who has work now: an open task or a running project" state={state} to="/people/employees"
      table={{ columns: ['Category', 'Freelancers'], rows: categories.map((c) => [c.key === 'none' ? 'Not recorded' : c.key, count(c.count)]) }}>
      {card?.available && (
        <Facts items={[
          ['Freelancers', count(card.total)],
          ['With work now', count(card.active)],
          ['Running projects they are on', count(card.projects)],
          card.without_login > 0 && ['Without a login (work not tracked)', count(card.without_login), 'warn'],
        ]} />
      )}
      <BarList format={count} emptyText="No freelancers recorded."
        rows={categories.map((c) => ({ key: c.key, label: c.key === 'none' ? 'Not recorded' : c.key, value: c.count, tipLabel: 'Freelancers' }))} />
    </Card>
  )
}
