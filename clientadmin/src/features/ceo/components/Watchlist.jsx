import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ceoApi } from '@/features/ceo/api.js'
import { Stat } from '@/features/ceo/components/Parts.jsx'
import { count, label, moneyIN, num } from '@/features/ceo/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import { BarList, ChartCard, ColumnChart, ORDINAL, Ring, SERIES, STATUS } from '@/shared/components/Charts.jsx'

const MONTHS = 6
const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const monthOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
const monthCats = (keys) => keys.map((k) => ({ key: k, label: monthShort.format(monthOf(k)), title: monthLong.format(monthOf(k)) }))
const HEALTH = {
  green: { label: 'On track', color: STATUS.good, icon: '●' },
  amber: { label: 'At risk', color: STATUS.warning, icon: '▲' },
  red: { label: 'Off track', color: STATUS.critical, icon: '■' },
  unknown: { label: 'Not assessed', color: '#94a3b8', icon: '○' },
}

const thisMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Six cards a head of the company checks next to the fifteen above, for ONE company (the
// switcher). The screen above adds every company up; money owed, project health, tax and
// movement of people are read per company, so these follow the company picked here.
export default function Watchlist() {
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const may = (rule) => Boolean(orgId) && hasAccess(user, rule)
  const opts = (rule) => ({ enabled: may(rule), keepPrevious: true })
  // Each query carries whether this person may read it, so a card they may not read is left out.
  const asked = (query, rule) => ({ ...query, enabled: may(rule) })
  // Same keys as the Dashboard's, so a company already opened there is answered from the cache.
  const invoices = asked(useQuery(['overview', orgId, 'invoices', MONTHS], (o) => ceoApi.invoices(orgId, MONTHS, o), opts(ACCESS.invoices)), ACCESS.invoices)
  const payments = asked(useQuery(['overview', orgId, 'payments', MONTHS], (o) => ceoApi.payments(orgId, MONTHS, o), opts(ACCESS.payments)), ACCESS.payments)
  const projects = asked(useQuery(['overview', orgId, 'projects'], (o) => ceoApi.projects(orgId, o), opts(ACCESS.projects)), ACCESS.projects)
  const people = asked(useQuery(['overview', orgId, 'workforce', MONTHS], (o) => ceoApi.workforce(orgId, MONTHS, o), opts(ACCESS.people)), ACCESS.people)
  const tax = asked(useQuery(['gst-vs-cash', orgId, thisMonth()], (o) => ceoApi.gstVsCash(orgId, thisMonth(), o), opts(ACCESS.taxReports)), ACCESS.taxReports)

  if (![invoices, payments, projects, people, tax].some((q) => q.enabled)) return null

  return (
    <section className="cc-watch" aria-label="Company watchlist">
      <div className="cc-watch-head">
        <div>
          <h2>Company watchlist</h2>
          <p>The money, projects, tax and people of one company. The cards above add every company up.</p>
        </div>
        <OrgSwitcher />
      </div>
      <div className="cc-row cols-3">
        <CashFlow invoices={invoices} payments={payments} name={activeOrg?.name} />
        <Receivables invoices={invoices} />
        <TaxPosition tax={tax} />
      </div>
      <div className="cc-row cols-2">
        <ProjectsAtRisk projects={projects} />
        <PeopleMovement people={people} />
      </div>
    </section>
  )
}

// What is left when a card has nothing to draw: loading, could not load, or nothing yet.
function Empty({ query, text }) {
  if (query.loading && !query.data) return <p className="chart-empty">Loading…</p>
  if (query.error && !query.data) return <p className="chart-empty">Can’t load right now. Try Refresh in a moment.</p>
  return <p className="chart-empty">{text}</p>
}

// Invoiced against collected, month by month: the gap is money waiting to come in.
function CashFlow({ invoices, payments }) {
  if (!invoices.enabled && !payments.enabled) return null
  const inv = invoices.data
  const pay = payments.data
  const cur = inv?.currency || pay?.currency || 'INR'
  const keys = [...new Set([...(inv?.invoiced_by_month ?? []).map((m) => m.month), ...(pay?.collected_by_month ?? []).map((m) => m.month)])].sort()
  const at = (list, k) => num((list ?? []).find((m) => m.month === k)?.amount.amount)
  const series = [
    inv && { key: 'invoiced', label: 'Invoiced', color: SERIES[0], values: keys.map((k) => at(inv.invoiced_by_month, k)) },
    pay && { key: 'collected', label: 'Collected', color: SERIES[2], values: keys.map((k) => at(pay.collected_by_month, k)) },
  ].filter(Boolean)
  const invoicedTotal = series.find((s) => s.key === 'invoiced')?.values.reduce((a, b) => a + b, 0)
  const collectedTotal = series.find((s) => s.key === 'collected')?.values.reduce((a, b) => a + b, 0)
  return (
    <ChartCard title="Cash flow" subtitle={`Invoiced and collected per month · last ${MONTHS} months`}
      legend={series.map((s) => ({ label: s.label, color: s.color }))}
      table={{ columns: ['Month', ...series.map((s) => s.label)], rows: keys.map((k, i) => [monthLong.format(monthOf(k)), ...series.map((s) => moneyIN(s.values[i], cur))]) }}>
      {keys.length === 0 ? (
        <Empty query={invoices.data ? payments : invoices} text="Nothing invoiced or collected yet." />
      ) : (
        <>
          {invoicedTotal !== undefined && collectedTotal !== undefined && (
            <div className="cc-stats">
              <Stat label="Invoiced" value={moneyIN(invoicedTotal, cur)} />
              <Stat label="Collected" value={moneyIN(collectedTotal, cur)} tone="good" />
              <Stat label="Still to collect" value={moneyIN(Math.max(0, invoicedTotal - collectedTotal), cur)} tone={invoicedTotal > collectedTotal ? 'warn' : ''} />
            </div>
          )}
          <div className="cc-chart">
            <ColumnChart height="fill" format={(v) => moneyIN(v, cur)} categories={monthCats(keys)} series={series} />
          </div>
        </>
      )}
    </ChartCard>
  )
}

// Money owed, how late it is, and who owes the most.
function Receivables({ invoices }) {
  if (!invoices.enabled) return null
  const inv = invoices.data
  const cur = inv?.currency || 'INR'
  const owed = inv ? num(inv.outstanding.amount) : 0
  const late = inv ? num(inv.overdue.amount) : 0
  return (
    <ChartCard title="Receivables" subtitle="Money owed to you, by how long past its due date"
      action={<Link className="link-btn" to="/collections">Collections</Link>}
      table={inv ? { columns: ['Age', 'Invoices', 'Owed'], rows: inv.aging.map((a) => [label(a.key), count(a.count), moneyIN(a.amount.amount, cur)]) } : undefined}>
      {!inv ? (
        <Empty query={invoices} text="Nothing owed." />
      ) : (
        <>
          <div className="cc-stats">
            <Stat label="Owed to you" value={moneyIN(owed, cur)} />
            <Stat label="Of which late" value={moneyIN(late, cur)} tone={late > 0 ? 'bad' : 'good'} />
          </div>
          <BarList format={(v) => moneyIN(v, cur)} colors={ORDINAL}
            rows={inv.aging.map((a) => ({ key: a.key, label: label(a.key), value: num(a.amount.amount), sub: `${count(a.count)} inv.` }))} />
          {inv.top_balances.length > 0 && (
            <>
              <h4>Owes you the most</h4>
              <ol className="rank-list">
                {inv.top_balances.slice(0, 5).map((c) => (
                  <li key={c.client_id}>
                    <Link to={`/customers/${c.client_id}`}>{c.name || 'Customer'}</Link>
                    <span>{moneyIN(c.balance.amount, cur)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </ChartCard>
  )
}

// GST owed on what was invoiced against the GST in what customers actually paid, this month.
function TaxPosition({ tax }) {
  if (!tax.enabled) return null
  const r = tax.data
  const cur = r?.currency || 'INR'
  const gap = r ? num(r.gap.amount) : 0
  return (
    <ChartCard title="Tax position" subtitle="GST this month: owed on invoices issued against paid by customers"
      action={<Link className="link-btn" to="/tax-reports">Tax reports</Link>}
      table={r ? { columns: ['', 'Amount'], rows: [['GST on invoices issued', moneyIN(r.gst_on_documents.amount, cur)], ['GST in what customers paid', moneyIN(r.gst_in_settlements.amount, cur)], ['Gap', moneyIN(gap, cur)], ['TDS withheld', moneyIN(r.tds_withheld.amount, cur)]] } : undefined}>
      {!r ? (
        <Empty query={tax} text="No tax figures for this month." />
      ) : (
        <>
          <div className="cc-stats">
            <Stat label="GST on invoices" value={moneyIN(r.gst_on_documents.amount, cur)} />
            <Stat label="GST paid by customers" value={moneyIN(r.gst_in_settlements.amount, cur)} />
            <Stat label="Paid ahead of collecting" value={moneyIN(Math.max(0, gap), cur)} tone={gap > 0 ? 'warn' : 'good'} />
          </div>
          <BarList format={(v) => moneyIN(v, cur)} colors={[SERIES[0], SERIES[2], SERIES[1]]}
            rows={[
              { key: 'owed', label: 'GST owed on invoices', value: num(r.gst_on_documents.amount) },
              { key: 'paid', label: 'GST in customers’ payments', value: num(r.gst_in_settlements.amount) },
              { key: 'tds', label: 'TDS withheld by customers', value: num(r.tds_withheld.amount) },
            ]} />
          <p className="cc-note-line">A gap is GST you pay the government before you have collected it. Filing dates are not tracked here.</p>
        </>
      )}
    </ChartCard>
  )
}

// The running projects that are late or off track, worst first.
function ProjectsAtRisk({ projects }) {
  if (!projects.enabled) return null
  const data = projects.data
  const list = (data?.needs_attention ?? []).slice(0, 6)
  return (
    <ChartCard title="Projects at risk" subtitle={data ? `${count(data.running)} running · ${count(data.late)} past their end date` : 'Off track, at risk or past their end date'}
      action={<Link className="link-btn" to="/projects">Projects</Link>}
      table={data ? { columns: ['Project', 'Health', 'Done'], rows: data.needs_attention.map((p) => [p.name, (HEALTH[p.health] || HEALTH.unknown).label, `${Math.round(p.progress_pct)}%`]) } : undefined}>
      {list.length === 0 ? (
        <Empty query={projects} text="No project needs attention." />
      ) : (
        <ul className="attention-list">
          {list.map((p) => {
            const meta = HEALTH[p.health] || HEALTH.unknown
            const ended = p.planned_end && new Date(`${p.planned_end}T00:00:00`) < new Date()
            return (
              <li key={p.id}>
                <Ring value={p.progress_pct} color={meta.color} size={40} label={`${Math.round(p.progress_pct)}% done`} />
                <div>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  <div className="muted small">
                    <span style={{ color: meta.color }} aria-hidden="true">{meta.icon}</span> {meta.label} · {Math.round(p.progress_pct)}% done
                    {ended ? ' · past its end date' : ''}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </ChartCard>
  )
}

// Who joined and who left, and what share of the team that is.
function PeopleMovement({ people }) {
  if (!people.enabled) return null
  const data = people.data
  const moves = data?.moves_by_month ?? []
  const left = moves.reduce((s, m) => s + num(m.left), 0)
  const joined = moves.reduce((s, m) => s + num(m.joined), 0)
  const attrition = data && data.headcount > 0 ? Math.round((left / data.headcount) * 100) : null
  return (
    <ChartCard title="People movement" subtitle={`Joined and left per month · last ${MONTHS} months`}
      legend={[{ label: 'Joined', color: SERIES[2] }, { label: 'Left', color: SERIES[1] }]}
      table={data ? { columns: ['Month', 'Joined', 'Left'], rows: moves.map((m) => [monthLong.format(monthOf(m.month)), count(m.joined), count(m.left)]) } : undefined}>
      {!data ? (
        <Empty query={people} text="No people recorded." />
      ) : (
        <>
          <div className="cc-stats four">
            <Stat label="On the payroll" value={count(data.headcount)} />
            <Stat label="Joined" value={count(joined)} tone="good" />
            <Stat label="Left" value={count(left)} tone={left > 0 ? 'warn' : ''} />
            {attrition !== null && <Stat label={`Left, ${MONTHS} months`} value={`${attrition}%`} tone={attrition >= 10 ? 'bad' : attrition >= 5 ? 'warn' : 'good'} />}
          </div>
          <div className="cc-chart">
            <ColumnChart height="fill" format={count} categories={monthCats(moves.map((m) => m.month))}
              series={[
                { key: 'joined', label: 'Joined', color: SERIES[2], values: moves.map((m) => num(m.joined)) },
                { key: 'left', label: 'Left', color: SERIES[1], values: moves.map((m) => num(m.left)) },
              ]} />
          </div>
        </>
      )}
    </ChartCard>
  )
}
