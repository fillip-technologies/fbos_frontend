import { useState } from 'react'
import '@/features/ceo/ceo.css'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ceoApi } from '@/features/ceo/api.js'
import {
  Amc, AssociatesTable, ClientDonut, CompaniesTable, ExpenseShares, FieldTeam, FinanceIncome, Freelancers, Geography,
  Hardware, KeyAlerts, NextSteps, Procurement, SegmentDonut, TrendLine,
} from '@/features/ceo/components/Cards.jsx'
import { Delta } from '@/features/ceo/components/Parts.jsx'
import { count, moneyIN, num, periodFor, RANGES, REASON_TEXT } from '@/features/ceo/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useTaxEntries } from '@/features/tax/useTaxConfig.js'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import { useCountUp } from '@/shared/components/Charts.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const dayShort = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dayOf = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

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
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? 'This month'

  return (
    <div className={`ceo cc${busy ? ' is-refetching' : ''}`}>
      <div className="cc-head">
        <div>
          <h1>CEO Command Center</h1>
          <p>Complete overview of all businesses, segments, companies, associates and enterprise performance</p>
        </div>
        <div className="cc-filters">
          {screen && (
            <span className="cc-date" title="Period shown">
              {dayShort.format(dayOf(screen.period.from_date))} - {dayShort.format(dayOf(screen.period.to_date))}
            </span>
          )}
          <select className="cc-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button type="button" className="btn secondary small-btn" onClick={query.reload} aria-busy={busy}>Refresh</button>
        </div>
      </div>

      {query.error && !screen && <ErrorBanner error={query.error} onRetry={query.reload} />}
      {query.loading && !screen && <PanelSkeleton panels={4} />}
      {screen && <Screen screen={screen} names={names} range={range} rangeLabel={rangeLabel} />}
    </div>
  )
}

// Names for the ids revenue keeps (places of supply), from the active company's lookups.
function useNames(orgId) {
  const { entries: places } = useTaxEntries(orgId, 'jurisdiction')
  return {
    place: (code) => places.find((p) => p.code === code)?.data?.name ?? code,
  }
}

// The fifteen cards of the reference screen, in its order: four rows of three, three and four, then five.
function Screen({ screen, names, range, rangeLabel }) {
  const fmt = (v) => moneyIN(v, screen.currency)
  return (
    <>
      {screen.mixed_currencies && (
        <div className="alert warn">Some records use another currency; their amounts are added as they are, in {screen.currency}.</div>
      )}
      <Headlines kpis={screen.kpis} fmt={fmt} compare={range === 'this_month' ? 'vs. last month' : 'vs. previous period'} />

      <div className="cc-row cols-3">
        <SegmentDonut n={1} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <TrendLine n={2} screen={screen} fmt={fmt} />
        <CompaniesTable n={3} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
      </div>
      <div className="cc-row cols-3 wide-mid">
        <AssociatesTable n={4} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <Geography n={5} screen={screen} names={names} fmt={fmt} />
        <ClientDonut n={6} screen={screen} rangeLabel={rangeLabel} />
      </div>
      <div className="cc-row cols-4">
        <Procurement n={7} screen={screen} rangeLabel={rangeLabel} />
        <Hardware n={8} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <Amc n={9} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <FieldTeam n={10} screen={screen} rangeLabel={rangeLabel} />
      </div>
      <div className="cc-row cols-5">
        <FinanceIncome n={11} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <ExpenseShares n={12} screen={screen} fmt={fmt} rangeLabel={rangeLabel} />
        <Freelancers n={13} screen={screen} rangeLabel={rangeLabel} />
        <KeyAlerts n={14} screen={screen} fmt={fmt} />
        <NextSteps n={15} screen={screen} fmt={fmt} />
      </div>
    </>
  )
}

// ---------- Headline numbers ----------
const TILE_ICONS = {
  revenue: ['M4 20V10m6 10V4m6 16v-7m4 7H2', '#16a34a'],
  profit: ['M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01', '#2563eb'],
  pipeline: ['M12 2l3 6 6 .9-4.5 4.3L17.6 20 12 17l-5.6 3 1.1-6.8L3 8.9 9 8z', '#7c3aed'],
  receivables: ['M3 7h18v12H3zM3 11h18M7 15h3', '#ea580c'],
  projects: ['M9 3h6v3H9zM6 5h12v16H6zM9 11h6M9 15h6', '#0891b2'],
  clients: ['M16 11a3 3 0 100-6 3 3 0 000 6zM8 12a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5', '#db2777'],
  employees: ['M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-7 8-7s8 3 8 7', '#6366f1'],
  expenses: ['M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', '#f59e0b'],
}

function Headlines({ kpis, fmt, compare }) {
  const tiles = [
    { key: 'revenue', title: 'Total Revenue', metric: kpis.total_revenue, format: fmt, to: '/invoices' },
    { key: 'profit', title: 'Total Profit', metric: kpis.total_profit, format: fmt },
    { key: 'pipeline', title: 'Sales Pipeline', metric: kpis.sales_pipeline, format: fmt, to: '/opportunities' },
    { key: 'receivables', title: 'Receivables', metric: kpis.receivables, format: fmt, to: '/collections', higherIsBetter: false },
    { key: 'projects', title: 'Active Work Units', metric: kpis.active_work_units, format: count, to: '/projects' },
    { key: 'clients', title: 'Total Clients', metric: kpis.total_clients, format: count, to: '/customers' },
    { key: 'employees', title: 'Total Employees', metric: kpis.total_employees, format: count, to: '/users' },
    { key: 'expenses', title: 'Total Expenses', metric: kpis.total_expenses, format: fmt, to: '/budgets', higherIsBetter: false },
  ]
  return (
    <div className="cc-kpis">
      {tiles.map(({ key, ...tile }) => <Kpi key={key} icon={key} compare={compare} {...tile} />)}
    </div>
  )
}

function Kpi({ icon, title, metric, format, to, higherIsBetter = true, compare }) {
  const shown = useCountUp(num(metric.value?.amount))
  const unavailable = !metric.available || !metric.value
  const [path, color] = TILE_ICONS[icon]
  const note = unavailable ? REASON_TEXT[metric.reason] ?? REASON_TEXT.unavailable : metric.organizations_missing > 0 ? `${metric.organizations_missing} not included` : null
  const body = (
    <>
      <span className="kpi-icon" style={{ '--tile': color }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
      </span>
      <div className="kpi-text">
        <div className="kpi-label">{title}</div>
        <div className={`kpi-value${unavailable ? ' muted' : ''}`}>{unavailable ? '—' : format(shown)}</div>
        {!unavailable && (
          <div className="kpi-sub">
            <Delta value={metric.value.amount} previous={metric.value.previous} higherIsBetter={higherIsBetter} />
            {metric.value.previous !== null && metric.value.previous !== undefined && <span className="cc-vs"> {compare}</span>}
          </div>
        )}
        {note && <div className="kpi-sub">{note}</div>}
      </div>
    </>
  )
  return to && !unavailable ? <Link to={to} className="kpi">{body}</Link> : <div className="kpi">{body}</div>
}
