import { useState } from 'react'
import { Link } from 'react-router-dom'
import IndiaMap, { mapIdFor } from '@/features/ceo/components/IndiaMap.jsx'
import { Delta, Donut, DonutLegend, MiniBars, Panel, Stat } from '@/features/ceo/components/Parts.jsx'
import { count, label, moneyIN, num, segmentLabel, shares } from '@/features/ceo/utils.js'
import { LineChart, SERIES } from '@/shared/components/Charts.jsx'

const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const pct = (n) => `${n}%`

// 1. Revenue by business segment: the four customer segments plus income outside sales.
export function SegmentDonut({ n, screen, fmt, rangeLabel }) {
  const segments = (screen.revenue.by_segment ?? []).map((s) => ({ key: `${s.sector}-${s.market}`, label: segmentLabel(s), value: num(s.amount) }))
  const other = screen.finance.available && screen.finance.other_income ? num(screen.finance.other_income.amount) : 0
  const rows = shares([...segments, ...(other > 0 ? [{ key: 'other-income', label: 'Other income (FD, MF, investment)', value: other }] : [])].filter((r) => r.value > 0))
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  return (
    <Panel n={n} title="Revenue by Business Segment" state={screen.revenue} rangeLabel={rangeLabel} to="/customers">
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
            <tr><th>Associate Company</th><th className="r">Projects</th>{withMoney && <><th className="r">Revenue (₹)</th><th className="r">Work Given (₹)</th><th className="r">Margin</th></>}<th>Status</th></tr>
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

// 5. Geography: the states by revenue or customers (the backend has no per-state projects).
export function Geography({ n, screen, names, fmt }) {
  const [tab, setTab] = useState('revenue')
  const revenue = (screen.revenue.by_state ?? []).filter((r) => r.key !== 'none').map((r) => ({ key: r.key, label: names.place(r.key), value: num(r.amount) }))
  const clients = (screen.revenue.clients_by_state ?? []).filter((r) => r.key !== 'none').map((r) => ({ key: r.key, label: names.place(r.key), value: num(r.count) }))
  const rows = [...(tab === 'revenue' ? revenue : clients)].sort((a, b) => b.value - a.value)
  const top = rows.slice(0, 5)
  const least = rows.length > 5 ? rows.slice(-Math.min(5, rows.length - 5)).reverse() : []
  const format = tab === 'revenue' ? fmt : count
  const onMap = {}
  for (const r of rows) {
    const id = mapIdFor(r.key, r.label)
    if (id) onMap[id] = { value: (onMap[id]?.value ?? 0) + r.value }
  }
  return (
    <Panel n={n} title="Geography Performance (India)" state={screen.revenue} to="/invoices">
      <div className="cc-tabs" role="group" aria-label="Show by">
        {[['revenue', 'Revenue'], ['clients', 'Clients']].map(([key, text]) => (
          <button key={key} type="button" className={tab === key ? 'active' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}>{text}</button>
        ))}
      </div>
      <div className="cc-geo">
        <IndiaMap title={`India by state, ${tab}`} format={format} values={onMap} />
        <div className="cc-geo-lists">
          <div>
            <h4>Top {top.length || 5} Performing States</h4>
            <MiniBars rows={top.map((r) => ({ ...r, color: '#2563eb' }))} format={(v) => format(v)} empty="No states recorded yet." />
          </div>
          <div>
            <h4>Least Performing States</h4>
            <MiniBars rows={least.map((r) => ({ ...r, color: '#ef4444' }))} format={(v) => format(v)} empty="Needs more than five states." />
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

// 7. Procurement and purchase.
export function Procurement({ n, screen, rangeLabel }) {
  const section = screen.procurement
  const budget = screen.budget
  const categories = shares((section.by_category ?? []).map((c) => ({ key: c.key, label: c.key, value: num(c.amount) })))
  return (
    <Panel n={n} title="Procurement & Purchase" state={section} rangeLabel={rangeLabel} to="/inventory/purchase-orders">
      <div className="cc-stats">
        {section.committed && (
          <Stat label="Total Purchases" value={moneyIN(section.committed.amount, screen.currency)}>
            <Delta value={section.committed.amount} previous={section.committed.previous} higherIsBetter={false} />
          </Stat>
        )}
        <Stat label="Approved Orders" value={count(section.committed_count)} />
        {budget.available && budget.used_pct !== null && <Stat label="Budget Used" value={pct(budget.used_pct)} tone={budget.used_pct > 100 ? 'bad' : budget.used_pct > 85 ? 'warn' : 'good'} />}
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

// 8. Hardware business: hardware revenue, devices installed and AMC contracts.
export function Hardware({ n, screen, fmt, rangeLabel }) {
  const lines = screen.revenue.by_product_line ?? []
  const hardware = lines.find((l) => l.key === 'hardware')
  const amc = screen.revenue.amc
  const procurement = screen.procurement
  return (
    <Panel n={n} title="Hardware Business" state={screen.revenue} rangeLabel={rangeLabel} to="/inventory">
      <div className="cc-stats">
        <Stat label="Revenue" value={fmt(hardware?.amount ?? 0)} />
        {procurement.available && <Stat label="Devices Installed" value={count(procurement.installations)} />}
        {amc && <Stat label="Active AMC" value={count(amc.active_contracts)} />}
      </div>
      <h4>Revenue by Product Line</h4>
      <MiniBars rows={shares(lines.map((l) => ({ key: l.key, label: l.key === 'none' ? 'Not set on the offering' : label(l.key), value: num(l.amount) })))}
        format={(v) => fmt(v)} empty="No revenue in this period." />
    </Panel>
  )
}

// 9. AMC and services.
export function Amc({ n, screen, fmt, rangeLabel }) {
  const amc = screen.revenue.amc
  return (
    <Panel n={n} title="AMC & Services Business" state={screen.revenue} rangeLabel={rangeLabel} to="/contracts">
      {amc && (
        <>
          <div className="cc-stats">
            <Stat label="AMC Revenue" value={fmt(amc.revenue)} />
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

// 10. Field employees: technicians and where people work today.
export function FieldTeam({ n, screen, rangeLabel }) {
  const field = screen.field
  const people = screen.people
  return (
    <Panel n={n} title="Field Employees (Technicians)" state={field} rangeLabel={rangeLabel} to="/inventory/issues">
      <div className="cc-stats four">
        <Stat label="Total" value={count(field.technicians)} />
        <Stat label="Available" value={count(field.technicians_available)} tone="good" />
        {people.available && <Stat label="On Field Today" value={count(people.working_today?.field)} />}
        {people.available && <Stat label="On Leave" value={count(people.on_leave_today)} tone="warn" />}
      </div>
      <h4>Field Activity</h4>
      <MiniBars format={(v) => count(v)} empty="Nothing recorded."
        rows={[
          { key: 'repairs', label: 'Open repairs', value: field.open_repairs, color: '#f59e0b' },
          ...(screen.procurement.available ? [{ key: 'installs', label: 'Devices installed', value: screen.procurement.installations, color: '#16a34a' }] : []),
          ...(screen.procurement.available ? [{ key: 'new', label: 'New installations', value: screen.procurement.new_installs, color: '#2563eb' }] : []),
        ]} />
    </Panel>
  )
}

// 11. Finance and investment income.
export function FinanceIncome({ n, screen, fmt, rangeLabel }) {
  const section = screen.finance
  const income = section.income_by_type ?? []
  const total = section.other_income
  return (
    <Panel n={n} title="Finance & Investment Income" state={section} rangeLabel={rangeLabel} to="/investments">
      <ul className="cc-rows">
        {income.map((b) => (
          <li key={b.key}><span>{label(b.key)}</span><strong>{fmt(b.amount)}</strong></li>
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
      <MiniBars rows={rows} format={(v, r) => `${r.pct}%`} empty="No expenses recorded in this period." />
      {section.total && <p className="cc-note-line">Total {fmt(section.total.amount)}{section.complete ? '' : ' · some sources not included'}</p>}
    </Panel>
  )
}

// 13. Freelancer network: what People holds (a headcount and the employment types).
export function Freelancers({ n, screen, rangeLabel }) {
  const section = screen.people
  const types = shares((section.by_employment_type ?? []).map((b) => ({ key: b.key, label: label(b.key), value: b.count })))
  return (
    <Panel n={n} title="Freelancer Network" state={section} rangeLabel={rangeLabel} to="/users">
      <div className="cc-stats">
        <Stat label="Total Freelancers" value={count(section.freelancers)} />
        <Stat label="Total People" value={count(section.headcount)} />
      </div>
      <h4>People by Employment Type</h4>
      <MiniBars rows={types} format={(_, r) => `${r.pct}%`} />
    </Panel>
  )
}

// 14. Key alerts and approvals, each with how pressing it is.
export function KeyAlerts({ n, screen, fmt }) {
  const a = screen.alerts
  const items = [
    a.overdue_receivables > 0 && { key: 'overdue', text: `Receivables of ${fmt(a.overdue_receivables)} are overdue`, level: 'High', to: '/collections' },
    a.at_risk_projects > 0 && { key: 'risk', text: `${a.at_risk_projects} projects at risk of delay`, level: 'High', to: '/projects' },
    a.renewals_due > 0 && { key: 'renewals', text: `Hardware AMC renewals due (${a.renewals_due})`, level: 'Medium', to: '/contracts' },
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
