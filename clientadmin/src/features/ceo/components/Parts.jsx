import { Link } from 'react-router-dom'
import { delta, num } from '@/features/ceo/utils.js'

// The ten colours of the reference screen's donuts and bars, in order.
export const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#f97316']

function reasonText(reason) {
  if (reason === 'no_access') return 'You don’t have access to these figures. Your administrator can grant it.'
  if (reason === 'not_set_up') return 'Not set up yet.'
  return 'These figures can’t be loaded right now. Try Refresh in a moment.'
}

// One numbered card: title, the period chip and a body. A section that could not be read says why.
export function Panel({ n, title, state, rangeLabel, to, className = '', children }) {
  const ok = !state || state.available
  const missing = ok && state?.organizations_missing > 0 ? `${state.organizations_missing} not included` : null
  return (
    <section className={`cc-card ${className}`}>
      <header className="cc-card-head">
        <h3>
          {n ? <span className="cc-n">{n}.</span> : null}
          {title}
        </h3>
        {missing && <span className="cc-note">{missing}</span>}
        {rangeLabel && <span className="cc-chip">{rangeLabel}</span>}
        {to && ok && (
          <Link to={to} className="cc-open">
            Open
          </Link>
        )}
      </header>
      <div className="cc-card-body">{ok ? children : <p className="chart-empty">{reasonText(state.reason)}</p>}</div>
    </section>
  )
}

// "↑ 18%" in green or red.
export function Delta({ value, previous, higherIsBetter = true }) {
  const d = delta(value, previous, { higherIsBetter })
  if (!d) return null
  return <span className={`cc-delta ${d.tone}`}>{d.arrow ? `${d.arrow} ` : ''}{d.text}</span>
}

// A ring of parts with a label in the middle.
export function Donut({ parts, center, size = 160 }) {
  const total = parts.reduce((sum, p) => sum + num(p.value), 0)
  const r = 46
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="cc-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={center?.label ?? 'Share of total'}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sunken)" strokeWidth="20" />
        {total > 0 &&
          parts.map((p, i) => {
            const length = (num(p.value) / total) * circumference
            const shown = Math.max(0, length - 1)
            const node = (
              <circle key={p.key} cx="60" cy="60" r={r} fill="none" stroke={p.color ?? PALETTE[i % PALETTE.length]} strokeWidth="20"
                strokeDasharray={`${shown} ${circumference - shown}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
            )
            offset += length
            return node
          })}
      </svg>
      {center && (
        <div className="cc-donut-center">
          <strong>{center.value}</strong>
          <span>{center.label}</span>
        </div>
      )}
    </div>
  )
}

// The donut's legend: dot, name, share and amount.
export function DonutLegend({ rows, fmt }) {
  return (
    <ul className="cc-legend">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="cc-dot" style={{ background: r.color ?? PALETTE[i % PALETTE.length] }} />
          <span className="cc-legend-name">{r.label}</span>
          <span className="cc-legend-pct">{r.pct}%</span>
          {fmt && <span className="cc-legend-val">{fmt(r.value)}</span>}
        </li>
      ))}
    </ul>
  )
}

// Name, a bar and a figure: the small ranked lists of the reference screen.
export function MiniBars({ rows, format = (v) => `${v}%`, empty = 'Nothing recorded in this period.' }) {
  if (!rows.length) return <p className="chart-empty">{empty}</p>
  const max = Math.max(1, ...rows.map((r) => num(r.value)))
  return (
    <ul className="cc-bars">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="cc-bars-name">{r.label}</span>
          <span className="cc-bars-track">
            <span style={{ width: `${(num(r.value) / max) * 100}%`, background: r.color ?? PALETTE[i % PALETTE.length] }} />
          </span>
          <span className="cc-bars-val">{format(r.value, r)}</span>
        </li>
      ))}
    </ul>
  )
}

// A figure with a caption (and its change): the stat boxes inside a card.
export function Stat({ label, value, tone, children }) {
  return (
    <div className="cc-stat">
      <span className="cc-stat-label">{label}</span>
      <strong className={tone ? `cc-stat-value ${tone}` : 'cc-stat-value'}>{value}</strong>
      {children}
    </div>
  )
}
