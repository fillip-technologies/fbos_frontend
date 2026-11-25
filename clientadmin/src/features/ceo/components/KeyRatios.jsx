import { Link } from 'react-router-dom'
import { Delta } from '@/features/ceo/components/Parts.jsx'
import { count, HEALTH_TEXT, moneyIN, num, REASON_TEXT } from '@/features/ceo/utils.js'
import { Ring, STATUS } from '@/shared/components/Charts.jsx'

const HEALTH_COLOR = { excellent: STATUS.good, good: STATUS.good, needs_attention: STATUS.warning, critical: STATUS.critical }
const day = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
// Days in a period, both ends counted.
const daysIn = (p) => Math.max(1, Math.round((day(p.to_date) - day(p.from_date)) / 86_400_000) + 1)

// A figure that is there, or null when this person may not read it or it is not set up.
const valueOf = (metric) => (metric?.available && metric.value ? metric.value : null)

// The ratios a head of the company reads next to the totals: how healthy, how profitable, how
// fast money is collected and what each person brings in. Worked out from the figures the
// screen already holds; nothing here is stored anywhere.
export default function KeyRatios({ screen, compare }) {
  const k = screen.kpis
  const revenue = valueOf(k.total_revenue)
  const profit = valueOf(k.total_profit)
  const receivables = valueOf(k.receivables)
  const employees = valueOf(k.total_employees)
  const days = daysIn(screen.period)
  const previousDays = daysIn(screen.previous_period)
  const health = k.business_health

  // Profit as a share of revenue, now and in the period before (percentage points apart).
  const margin = revenue && profit && num(revenue.amount) > 0 ? (num(profit.amount) / num(revenue.amount)) * 100 : null
  const previousMargin = revenue?.previous > 0 && profit?.previous !== null && profit?.previous !== undefined ? (num(profit.previous) / num(revenue.previous)) * 100 : null
  // Days of revenue still waiting to be collected: receivables ÷ revenue × days in the period.
  const dso = revenue && receivables && num(revenue.amount) > 0 ? (num(receivables.amount) / num(revenue.amount)) * days : null
  const previousDso = revenue?.previous > 0 && receivables?.previous !== null && receivables?.previous !== undefined ? (num(receivables.previous) / num(revenue.previous)) * previousDays : null
  const perHead = revenue && employees && num(employees.amount) > 0 ? num(revenue.amount) / num(employees.amount) : null
  const previousPerHead = revenue?.previous !== null && revenue?.previous !== undefined && employees?.previous > 0 ? num(revenue.previous) / num(employees.previous) : null

  const why = (metric) => REASON_TEXT[metric?.reason] ?? REASON_TEXT.unavailable
  return (
    <section className="cc-ratios" aria-label="Key ratios">
      <Ratio title="Business health" to="/scorecard" missing={!health?.available || !health.value ? (health?.reason === 'not_set_up' ? 'Set up your scorecard' : why(health)) : null}>
        {health?.available && health.value && (
          <div className="cc-ratio-health">
            <span className="flowv-ring cc-ring">
              <Ring value={Math.min(100, num(health.value.amount))} max={100} size={64} color={HEALTH_COLOR[health.label] ?? STATUS.good} label={`Business health ${Math.round(num(health.value.amount))}%`} />
              <strong>{Math.round(num(health.value.amount))}%</strong>
            </span>
            <span className="cc-ratio-note" style={{ color: HEALTH_COLOR[health.label] }}>{HEALTH_TEXT[health.label] ?? ''}</span>
          </div>
        )}
      </Ratio>
      <Ratio title="Profit margin" missing={margin === null ? (profit ? 'No revenue yet' : why(k.total_profit)) : null} caption="Profit as a share of revenue">
        {margin !== null && (
          <>
            <strong className={`cc-ratio-value${margin < 0 ? ' bad' : ''}`}>{margin.toFixed(1)}%</strong>
            <Points now={margin} before={previousMargin} compare={compare} />
          </>
        )}
      </Ratio>
      <Ratio title="Days to collect" to="/collections" missing={dso === null ? (receivables ? 'No revenue yet' : why(k.receivables)) : null}
        caption="Receivables ÷ revenue × days in the period">
        {dso !== null && (
          <>
            <strong className={`cc-ratio-value${dso > 60 ? ' bad' : dso > 45 ? ' warn' : ''}`}>{count(dso)} days</strong>
            <Points now={dso} before={previousDso} compare={compare} unit="days" lowerIsBetter />
          </>
        )}
      </Ratio>
      <Ratio title="Revenue per person" missing={perHead === null ? why(employees ? k.total_revenue : k.total_employees) : null} caption="Revenue in the period ÷ employees">
        {perHead !== null && (
          <>
            <strong className="cc-ratio-value">{moneyIN(perHead, screen.currency)}</strong>
            <span className="cc-ratio-delta">
              <Delta value={perHead} previous={previousPerHead} />
              {previousPerHead ? <span className="cc-vs"> {compare}</span> : null}
            </span>
          </>
        )}
      </Ratio>
    </section>
  )
}

function Ratio({ title, to, missing, caption, children }) {
  const body = (
    <>
      <span className="cc-ratio-title">{title}</span>
      {missing ? <span className="cc-ratio-missing">{missing}</span> : children}
      {caption && !missing && <span className="cc-ratio-caption">{caption}</span>}
    </>
  )
  return to && !missing ? <Link to={to} className="cc-ratio">{body}</Link> : <div className="cc-ratio">{body}</div>
}

// The move against the period before, in points (margin) or days; null when there is nothing to compare.
function Points({ now, before, compare, unit = 'pp', lowerIsBetter = false }) {
  if (before === null || before === undefined) return null
  const diff = now - before
  if (Math.abs(diff) < 0.05) return <span className="cc-ratio-delta"><span className="cc-vs">No change {compare}</span></span>
  const better = lowerIsBetter ? diff < 0 : diff > 0
  const text = unit === 'days' ? `${Math.abs(Math.round(diff))} days` : `${Math.abs(diff).toFixed(1)} pp`
  return (
    <span className="cc-ratio-delta">
      <span className={`cc-delta ${better ? 'good' : 'bad'}`}>{diff > 0 ? '↑' : '↓'} {text}</span>
      <span className="cc-vs"> {compare}</span>
    </span>
  )
}
