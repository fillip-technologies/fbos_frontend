import { useState } from 'react'
import { Link } from 'react-router-dom'
import IndiaMap, { mapIdFor } from '@/features/ceo/components/IndiaMap.jsx'
import { Delta, Donut, DonutLegend, MiniBars, Panel, Stat } from '@/features/ceo/components/Parts.jsx'
import { count, label, moneyIN, num, segmentLabel, segmentName, shares } from '@/features/ceo/utils.js'
import { LineChart, SERIES } from '@/shared/components/Charts.jsx'

const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const pct = (n) => `${n}%`

// 1. Revenue by business segment: one segment per invoice line (they add up to the revenue),
// plus income outside sales.
export function SegmentDonut({ n, screen, fmt, rangeLabel }) {
  const section = screen.revenue
  const lines = section.by_business_segment ?? []
  const base = lines.length
    ? lines.map((r) => ({ key: r.key, label: segmentName(r.key), value: num(r.amount) }))
    : (section.by_segment ?? []).map((s) => ({ key: `${s.sector}-${s.market}`, label: segmentLabel(s), value: num(s.amount) }))
  const other = screen.finance.available && screen.finance.other_income ? num(screen.finance.other_income.amount) : 0
  const rows = shares([...base, ...(other > 0 ? [{ key: 'other-income', label: 'Other Income (FD, MF, Investment)', value: other }] : [])]
    .filter((r) => r.value > 0)).sort((a, b) => b.value - a.value)
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  return (
    <Panel n={n} title="Revenue by Business Segment" state={section} rangeLabel={rangeLabel} to="/invoices">
      {rows.length === 0 ? (
        <p className="chart-empty">No revenue in this period.</p>
      ) : (
        <div className="cc-donut-row">
          <Donut parts={rows} center={{ value: moneyIN(total, screen.currency), label: 'Total revenue' }} />
          <DonutLegend rows={rows} fmt={fmt} />
        </div>
      )}
    </Panel>
  )
}

// 2. Revenue trend: the nightly snapshots for 12 months, else the period's own months read live.
export function TrendLine({ n, screen, fmt }) {
  const trend = screen.trend
  const snapshots = trend?.available ? trend.months : []
  const recorded = snapshots.some((m) => m.revenue !== null)
  const months = recorded ? snapshots : (screen.revenue.by_month ?? []).map((m) => ({ month: m.month, revenue: num(m.amount) }))
  const financials = recorded && screen.can_see_financials
  const series = [{ key: 'revenue', label: 'Revenue', color: SERIES[0], values: months.map((m) => num(m.revenue)) }]
  if (financials) series.push({ key: 'profit', label: 'Profit', color: SERIES[2], values: months.map((m) => num(m.profit)) })
  return (
    <Panel n={n} title="Revenue Trend" state={recorded ? trend : screen.revenue} rangeLabel="12 months" to="/invoices">
      <div className="cc-legend-inline">
        {series.map((s) => (
          <span key={s.key}>
            <span className="cc-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="cc-chart">
        <LineChart height="fill" format={fmt} axisFormat={(v) => moneyIN(v, screen.currency).replace('₹ ', '')}
          categories={months.map((m) => ({ key: m.month, label: monthShort.format(monthOf(m.month)), title: monthLong.format(monthOf(m.month)) }))}
          series={series} />
      </div>
    </Panel>
  )
}

// 3. Business by company.
export function CompaniesTable({ n, screen, fmt, rangeLabel }) {
  const rows = (screen.companies.rows ?? []).filter((r) => r.revenue)
  const total = rows.reduce((sum, r) => sum + num(r.revenue.amount), 0)
  return (
    <Panel n={n} title="Business by Company" state={screen.companies} rangeLabel={rangeLabel} to="/organizations">
      <table className="cc-table">
        <thead>
          <tr><th>Company Name</th><th className="r">Revenue (₹)</th><th className="r">Contribution</th><th className="r">Growth</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.organization_id}>
              <td>{r.name}</td>
              <td className="r">{fmt(r.revenue.amount)}</td>
              <td className="r">{total > 0 ? `${Math.round((num(r.revenue.amount) / total) * 100)}%` : '—'}</td>
              <td className="r"><Delta value={r.revenue.amount} previous={r.revenue.previous} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="4" className="muted">No revenue in this period.</td></tr>}
        </tbody>
      </table>
    </Panel>
  )
}

// 4. Business from associate companies.
export function AssociatesTable({ n, screen, fmt, rangeLabel }) {
  const rows = screen.associates.rows ?? []
  const withMoney = screen.associates.revenue !== null && screen.associates.revenue !== undefined
  return (
    <Panel n={n} title="Business from Associate Companies" state={screen.associates} rangeLabel={rangeLabel} to="/projects">
      {rows.length === 0 ? (
        <p className="chart-empty">No projects given to associates yet. Name the associate on a project to see it here.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>Associate Company</th><th className="r">Projects</th>
              {withMoney && <><th className="r">Revenue (₹)</th><th className="r">Work Given (₹)</th><th className="r">Margin</th></>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.organization_id}>
                <td>{r.name}</td>
                <td className="r">{count(r.projects)}</td>
                {withMoney && (
                  <>
                    <td className="r">{r.revenue === null ? '—' : fmt(r.revenue)}</td>
                    <td className="r">{r.paid === null ? '—' : fmt(r.paid)}</td>
                    <td className="r">{r.revenue ? `${Math.round((num(r.margin) / r.revenue) * 100)}%` : '—'}</td>
                  </>
                )}
                <td><span className={`cc-status ${r.running > 0 ? 'on' : ''}`}>{r.running > 0 ? 'Active' : 'Idle'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

// 5. Geography: the map and the best and weakest states, by revenue (with its growth), projects or customers.
export function Geography({ n, screen, names, fmt }) {
  const [tab, setTab] = useState('revenue')
  const section = screen.revenue
  const sources = {
    revenue: (section.by_state ?? []).map((r) => ({ key: r.key, value: num(r.amount), previous: r.previous })),
    projects: (section.projects_by_state?.rows ?? []).map((r) => ({ key: r.key, value: num(r.count) })),
    clients: (section.clients_by_state ?? []).map((r) => ({ key: r.key, value: num(r.count) })),
  }
  const rows = sources[tab].filter((r) => r.key !== 'none').map((r) => ({ ...r, label: names.place(r.key) })).sort((a, b) => b.value - a.value)
  const top = rows.slice(0, 5)
  const least = rows.length > 5 ? rows.slice(-Math.min(5, rows.length - 5)).reverse() : []
  const format = tab === 'revenue' ? fmt : count
  const onMap = {}
  for (const r of rows) {
    const id = mapIdFor(r.key, r.label)
    if (id) onMap[id] = { value: (onMap[id]?.value ?? 0) + r.value }
  }
  const figure = (v, r) => (
    <>
      {format(v)}
      {r.previous !== undefined && <> <Delta value={r.value} previous={r.previous} /></>}
    </>
  )
  const state = tab === 'projects' ? (section.projects_by_state ?? { available: false, reason: 'unavailable' }) : section
  return (
    <Panel n={n} title="Geography Performance (India)" state={state} to="/invoices">
      <div className="cc-tabs" role="group" aria-label="Show by">
        {[['revenue', 'Revenue'], ['projects', 'Projects'], ['clients', 'Clients']].map(([key, text]) => (
          <button key={key} type="button" className={tab === key ? 'active' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{text}</button>
        ))}
      </div>
      <div className="cc-geo">
        <IndiaMap title={`India by state, ${tab}`} format={format} values={onMap} />
        <div className="cc-geo-lists">
          <div>
            <h4>Top {top.length || 5} Performing States</h4>
            <MiniBars rows={top.map((r) => ({ ...r, color: '#2563eb' }))} format={figure} empty="No states recorded yet." />
          </div>
          <div>
            <h4>Least Performing States</h4>
            <MiniBars rows={least.map((r) => ({ ...r, color: '#ef4444' }))} format={figure} empty="Needs more than five states." />
          </div>
        </div>
      </div>
      <p className="cc-note-line">Map: “Map of India” by VictorCazanave (@svg-maps/india), CC BY 4.0.</p>
    </Panel>
  )
}

// 6. Client type and segment.
export function ClientDonut({ n, screen, rangeLabel }) {
  const section = screen.revenue
  const segments = (section.clients_by_segment ?? []).map((s) => ({ key: `${s.sector}-${s.market}`, label: segmentLabel(s), value: num(s.count) }))
  const amc = section.amc?.clients ?? 0
  const rows = shares([...segments, ...(amc > 0 ? [{ key: 'amc', label: 'AMC clients', value: amc }] : [])].filter((r) => r.value > 0))
  const total = segments.reduce((sum, r) => sum + r.value, 0)
  return (
    <Panel n={n} title="Client Type & Segment" state={section} rangeLabel={rangeLabel} to="/customers">
      {rows.length === 0 ? (
        <p className="chart-empty">No customers yet.</p>
      ) : (
        <div className="cc-donut-row">
          <Donut parts={rows} center={{ value: count(total), label: 'Total clients' }} />
          <DonutLegend rows={rows} />
        </div>
      )}
    </Panel>
  )
}

// 7. Procurement and purchase, with the procurement budget when Management has one.
export function Procurement({ n, screen, rangeLabel }) {
  const section = screen.procurement
  const budget = section.budget
  const categories = shares((section.by_category ?? []).map((c) => ({ key: c.key, label: c.key, value: num(c.amount) })))
  const tone = budget?.over_budget > 0 ? 'bad' : budget?.used_pct > 85 ? 'warn' : 'good'
  return (
    <Panel n={n} title="Procurement & Purchase" state={section} rangeLabel={rangeLabel} to="/inventory/purchase-orders">
      <div className="cc-stats">
        {section.committed && (
          <Stat label="Total Purchases" value={moneyIN(section.committed.amount, screen.currency)}>
            <Delta value={section.committed.amount} previous={section.committed.previous} higherIsBetter={false} />
          </Stat>
        )}
        <Stat label="Approved Orders" value={count(section.committed_count)} />
        {budget?.available && budget.used_pct !== null && <Stat label="Budget Used" value={pct(budget.used_pct)} tone={tone} />}
        {budget?.available && budget.over_budget > 0 && <Stat label="Over Budget" value={moneyIN(budget.over_budget, screen.currency)} tone="bad" />}
      </div>
      {categories.length > 0 && (
        <>
          <h4>Top Purchase Categories</h4>
          <MiniBars rows={categories} format={(_, r) => pct(r.pct)} />
        </>
      )}
      {!section.by_category && <p className="cc-note-line">Categories need access to purchase costs.</p>}
    </Panel>
  )
}

// 8. Hardware business: hardware revenue and units (with their change), AMC contracts and the best sellers.
export function Hardware({ n, screen, fmt, rangeLabel }) {
  const section = screen.revenue
  const hardware = (section.by_product_line ?? []).find((l) => l.key === 'hardware')
  const units = section.hardware_units
  const amc = section.amc
  const products = (section.top_products ?? []).slice(0, 5)
  const withMoney = products.some((p) => p.revenue !== null && p.revenue !== undefined)
  return (
    <Panel n={n} title="Hardware Business" state={section} rangeLabel={rangeLabel} to="/offerings">
      <div className="cc-stats">
        <Stat label="Revenue" value={fmt(hardware?.amount ?? 0)}>
          {hardware && <Delta value={hardware.amount} previous={hardware.previous} />}
        </Stat>
        {units && (
          <Stat label="Units Sold" value={count(units.amount)}>
            <Delta value={units.amount} previous={units.previous} />
          </Stat>
        )}
        {amc && <Stat label="Active AMC" value={count(amc.active_contracts)} />}
      </div>
      <h4>Top Products</h4>
      {products.length === 0 ? (
        <p className="chart-empty">No products sold in this period.</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr><th>Product</th><th className="r">Units</th>{withMoney && <th className="r">Revenue</th>}</tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="r">{count(p.units)}</td>
                {withMoney && <td className="r">{p.revenue === null ? '—' : fmt(p.revenue)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

// 9. AMC and services. (The split of AMC by type is not recorded yet.)
export function Amc({ n, screen, fmt, rangeLabel }) {
  const amc = screen.revenue.amc
  return (
    <Panel n={n} title="AMC & Services Business" state={screen.revenue} rangeLabel={rangeLabel} to="/contracts">
      {amc && (
        <>
          <div className="cc-stats">
            <Stat label="AMC Revenue" value={fmt(amc.revenue)}>
              <Delta value={amc.revenue} previous={amc.revenue_previous} />
            </Stat>
            <Stat label="Active AMC" value={count(amc.active_contracts)} />
            <Stat label="Renewal Due" value={count(amc.renewals_due)} tone={amc.renewals_due > 0 ? 'warn' : ''} />
          </div>
          <dl className="ceo-facts">
            <div className="ceo-fact"><dt>Contract value</dt><dd>{fmt(amc.active_value)}</dd></div>
            <div className="ceo-fact"><dt>Customers on AMC</dt><dd>{count(amc.clients)}</dd></div>
          </dl>
        </>
      )}
    </Panel>
  )
}

// 10. Field employees: where the technicians are today and what the visits look like.
export function FieldTeam({ n, screen, rangeLabel }) {
  const field = screen.field
  const today = field.technicians_today
  const visits = field.visits_today
  const people = screen.people
  const activity = visits
    ? [
        { key: 'done', label: 'Site Visit Completed', value: visits.completed, color: '#16a34a' },
        { key: 'going', label: 'In Progress', value: visits.in_progress, color: '#2563eb' },
        { key: 'pending', label: 'Pending', value: visits.pending, color: '#f59e0b' },
        { key: 'late', label: 'Escalated', value: visits.escalated, color: '#ef4444' },
      ]
    : [
        { key: 'repairs', label: 'Open repairs', value: field.open_repairs, color: '#f59e0b' },
        ...(screen.procurement.available ? [{ key: 'installs', label: 'Devices installed', value: screen.procurement.installations, color: '#16a34a' }] : []),
      ]
  return (
    <Panel n={n} title="Field Employees (Technicians)" state={field} rangeLabel={rangeLabel} to="/inventory/issues">
      <div className="cc-stats four">
        <Stat label="Total" value={count(field.technicians)} />
        {today?.available ? (
          <>
            <Stat label="On Field" value={count(today.in_field)} tone="good" />
            <Stat label="At Office" value={count(today.at_office)} />
            <Stat label="On Leave" value={count(today.on_leave)} tone="warn" />
          </>
        ) : (
          <>
            <Stat label="Available" value={count(field.technicians_available)} tone="good" />
            {people.available && <Stat label="On Leave" value={count(people.on_leave_today)} tone="warn" />}
          </>
        )}
      </div>
      <h4>Today’s Field Activity</h4>
      <MiniBars rows={activity} format={(v) => count(v)} empty="Nothing recorded." />
    </Panel>
  )
}

// 11. Finance and investment income, each line with its change.
export function FinanceIncome({ n, screen, fmt, rangeLabel }) {
  const section = screen.finance
  const income = section.income_by_type ?? []
  const total = section.other_income
  return (
    <Panel n={n} title="Finance & Investment Income" state={section} rangeLabel={rangeLabel} to="/investments">
      <ul className="cc-rows">
        {income.map((b) => (
          <li key={b.key}>
            <span>{label(b.key)}</span>
            <strong>{fmt(b.amount)} <Delta value={b.amount} previous={b.previous} /></strong>
          </li>
        ))}
        {income.length === 0 && <li className="muted">No income recorded in this period.</li>}
        {total && (
          <li className="total">
            <span>Total</span>
            <strong>{fmt(total.amount)} <Delta value={total.amount} previous={total.previous} /></strong>
          </li>
        )}
      </ul>
      {section.investments && (
        <dl className="ceo-facts">
          <div className="ceo-fact"><dt>Invested (principal)</dt><dd>{fmt(section.investments.principal)}</dd></div>
          <div className="ceo-fact"><dt>Current value</dt><dd>{fmt(section.investments.current_value)}</dd></div>
        </dl>
      )}
    </Panel>
  )
}

// 12. Expense analysis: each recorded kind of spend as a share of all spend.
export function ExpenseShares({ n, screen, rangeLabel, fmt }) {
  const section = screen.expenses
  const finance = screen.finance
  const parts = (section.components ?? []).filter((c) => c.available)
  const splitOperating = finance.available && (finance.by_category ?? []).length > 0
  const rows = shares([
    ...parts.filter((c) => !(splitOperating && c.key === 'operating_expenses')).map((c) => ({ key: c.key, label: label(c.key), value: num(c.amount.amount) })),
    ...(splitOperating ? finance.by_category.map((c) => ({ key: `fin-${c.key}`, label: c.name, value: num(c.amount) })) : []),
  ].filter((r) => r.value > 0)).sort((a, b) => b.value - a.value)
  return (
    <Panel n={n} title="Expense Analysis" state={section} rangeLabel={rangeLabel} to="/budgets">
      <MiniBars rows={rows} format={(_, r) => `${r.pct}%`} empty="No expenses recorded in this period." />
      {section.total && <p className="cc-note-line">Total {fmt(section.total.amount)}{section.complete ? '' : ' · some sources not included'}</p>}
    </Panel>
  )
}

// 13. Freelancer network: who has work now, the projects they are on and what they do.
export function Freelancers({ n, screen, rangeLabel }) {
  const card = screen.people.freelancer_details
  const state = card ?? { available: false, reason: 'unavailable' }
  const categories = shares((card?.top_categories ?? []).map((c) => ({ key: c.key, label: c.key === 'none' ? 'Not recorded' : c.key, value: c.count })))
  return (
    <Panel n={n} title="Freelancer Network" state={state} rangeLabel={rangeLabel} to="/people/employees">
      <div className="cc-stats">
        <Stat label="Total Freelancers" value={count(card?.total)} />
        <Stat label="Active" value={count(card?.active)} tone="good" />
        <Stat label="Projects" value={count(card?.projects)} />
      </div>
      {card?.without_login > 0 && <p className="cc-note-line">{count(card.without_login)} without a login: their work is not tracked.</p>}
      <h4>Top Freelancer Categories</h4>
      <MiniBars rows={categories} format={(_, r) => pct(r.pct)} empty="No freelancers recorded." />
    </Panel>
  )
}

// 14. Key alerts and approvals, each with how pressing it is.
export function KeyAlerts({ n, screen, fmt }) {
  const a = screen.alerts
  const items = [
    a.overdue_receivables > 0 && { key: 'overdue', text: `Receivables of ${fmt(a.overdue_receivables)} are overdue`, level: 'High', to: '/collections' },
    a.at_risk_projects > 0 && { key: 'risk', text: `${a.at_risk_projects} projects at risk of delay`, level: 'High', to: '/projects' },
    a.renewals_due > 0 && { key: 'renewals', text: `AMC renewals due (${a.renewals_due})`, level: 'Medium', to: '/contracts' },
    a.expenses_awaiting_approval > 0 && { key: 'expenses', text: `${a.expenses_awaiting_approval} expenses waiting for approval`, level: 'Medium', to: '/expenses?approval_status=pending_approval' },
    a.approvals_pending > 0 && { key: 'approvals', text: `${a.approvals_pending}${a.approvals_more ? '+' : ''} approvals pending`, level: 'Medium', to: '/' },
    a.open_repairs > 0 && { key: 'repairs', text: `${a.open_repairs} devices out for repair`, level: 'Low', to: '/inventory/repairs' },
  ].filter(Boolean)
  const unknown = [a.approvals_pending, a.overdue_receivables, a.at_risk_projects].every((v) => v === null)
  return (
    <Panel n={n} title="Key Alerts & Approvals">
      <ul className="cc-alerts">
        {items.map((i) => (
          <li key={i.key}>
            <Link to={i.to}>{i.text}</Link>
            <span className={`cc-level ${i.level.toLowerCase()}`}>{i.level}</span>
          </li>
        ))}
        {items.length === 0 && <li className="muted">{unknown ? 'These figures aren’t available to you.' : 'Nothing needs your attention right now.'}</li>}
      </ul>
    </Panel>
  )
}

// 15. What to do next, worked out from the same figures (rules, not a language model).
export function NextSteps({ n, screen, fmt }) {
  const a = screen.alerts
  const steps = [
    a.overdue_receivables > 0 && `Follow up to recover ${fmt(a.overdue_receivables)} in overdue receivables.`,
    a.at_risk_projects > 0 && `Review the ${a.at_risk_projects} projects at risk of delay and add people where needed.`,
    a.renewals_due > 0 && `Start the renewal campaign for ${a.renewals_due} AMC contracts due in 30 days.`,
    a.approvals_pending > 0 && `Clear the ${a.approvals_pending}${a.approvals_more ? '+' : ''} approvals waiting for a decision.`,
    a.expenses_awaiting_approval > 0 && `Decide on ${a.expenses_awaiting_approval} expenses waiting for approval.`,
    screen.budget.available && screen.budget.used_pct > 85 && `Budget is ${screen.budget.used_pct}% used; check spend before the year ends.`,
  ].filter(Boolean)
  return (
    <Panel n={n} title="Decision Matrix">
      <p className="cc-ai-head">Based on current data, focus on:</p>
      {steps.length === 0 ? (
        <p className="muted">Nothing needs a decision right now.</p>
      ) : (
        <ol className="cc-steps">
          {steps.slice(0, 5).map((s) => <li key={s}>{s}</li>)}
        </ol>
      )}
      <Link to="/insights" className="btn secondary cc-analysis">View Detailed Analysis</Link>
    </Panel>
  )
}
