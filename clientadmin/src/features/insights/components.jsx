import { useState } from 'react'
import { Link } from 'react-router-dom'
import { kpiRag } from '@/features/insights/data.js'
import { SERIES, STATUS } from '@/shared/components/Charts.jsx'

// ---------- Words and numbers ----------
const num = (v) => Number(v ?? 0)
export const count = (v) => Math.round(num(v)).toLocaleString()
export const hours = (minutes) => {
  const h = num(minutes) / 60
  return `${h >= 100 ? Math.round(h).toLocaleString() : h.toFixed(h % 1 ? 1 : 0)} h`
}
export const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(num(v))}%`)
export function money(amount, currency = 'INR', compact = true) {
  try {
    return num(amount).toLocaleString(undefined, {
      style: 'currency', currency, notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 0,
    })
  } catch {
    return `${count(amount)} ${currency}`
  }
}

export const WORK_STAGES = [
  { key: 'todo', label: 'To do', color: SERIES[0] },
  { key: 'in_progress', label: 'In progress', color: SERIES[1] },
  { key: 'in_review', label: 'In review', color: SERIES[2] },
  { key: 'blocked', label: 'Blocked', color: SERIES[3] },
]

export const RAG = {
  green: { label: 'On track', icon: '●', color: STATUS.good },
  amber: { label: 'At risk', icon: '▲', color: STATUS.warning },
  red: { label: 'Off track', icon: '■', color: STATUS.critical },
}

// ---------- Small figures ----------
// A thin bar for a share (0–100); colour stays ink unless a status is meant.
export function ProgressBar({ value, tone, label }) {
  if (value === null || value === undefined) return <span className="muted">—</span>
  const v = Math.max(0, Math.min(100, num(value)))
  return (
    <span className="ins-progress" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <span className="ins-progress-track">
        <span className="ins-progress-fill" style={{ width: `${v}%`, background: tone ? STATUS[tone] : undefined }} />
      </span>
      <span className="ins-progress-value">{pct(value)}</span>
    </span>
  )
}

// Spent against approved: the track is what was approved, the fill what was spent; over the
// budget the fill turns critical and says so (icon + words, never colour alone).
export function BudgetBar({ actual, approved, currency }) {
  if (!approved && !actual) return <span className="muted">—</span>
  const used = approved > 0 ? (actual / approved) * 100 : null
  const over = used !== null && used > 100
  return (
    <span className="ins-budget" title={`${money(actual, currency, false)} spent of ${money(approved, currency, false)} approved`}>
      <span className="ins-progress-track">
        <span className="ins-progress-fill" style={{ width: `${Math.min(100, used ?? 100)}%`, background: over ? STATUS.critical : SERIES[0] }} />
      </span>
      <span className="ins-budget-text">
        {over && <span className="flag bad" aria-label="Over budget">▲ </span>}
        {money(actual, currency)} <span className="muted">/ {approved ? money(approved, currency) : 'not approved'}</span>
      </span>
    </span>
  )
}

// Open work split by stage, as one thin bar, with the total beside it.
export function WorkBar({ work, max }) {
  const total = WORK_STAGES.reduce((s, k) => s + num(work?.[k.key]), 0)
  if (!total) return <span className="muted">—</span>
  const width = max ? Math.max(6, (total / max) * 100) : 100
  return (
    <span className="ins-work" title={WORK_STAGES.map((k) => `${k.label}: ${count(work[k.key])}`).join(' · ')}>
      <span className="ins-work-track">
        <span className="ins-work-bar" style={{ width: `${width}%` }}>
          {WORK_STAGES.map((k) => (num(work[k.key]) ? <span key={k.key} style={{ flexGrow: num(work[k.key]), background: k.color }} /> : null))}
        </span>
      </span>
      <strong>{count(total)}</strong>
    </span>
  )
}

export function KpiChip({ score, count: n }) {
  if (score === null || score === undefined) return <span className="muted">—</span>
  const rag = RAG[kpiRag(score)]
  return (
    <span className="ins-kpi" title={`${n} KPI result${n === 1 ? '' : 's'}`}>
      <span style={{ color: rag.color }} aria-hidden="true">{rag.icon}</span>
      <strong>{pct(score)}</strong>
      <span className="muted">{rag.label}</span>
    </span>
  )
}

export function Stat({ label, value, sub, tone, to }) {
  const body = (
    <>
      <span className="ins-stat-label">{label}</span>
      <span className="ins-stat-value">{value}</span>
      {sub && <span className={`ins-stat-sub${tone ? ` ${tone}` : ''}`}>{sub}</span>}
    </>
  )
  return to ? <Link className="ins-stat" to={to}>{body}</Link> : <div className="ins-stat">{body}</div>
}

// ---------- The scoreboard: one row per branch, department, team or person ----------
// columns: [{ key, label, render(row), sort(row) → number|string, align }]
export function Scoreboard({ rows, columns, initialSort, empty = 'Nothing to show for this choice.' }) {
  // Follows `initialSort` (which can change once data arrives) until the user picks a column.
  const [chosen, setChosen] = useState(null)
  const fallback = initialSort ?? { key: columns[1]?.key, dir: -1 }
  const sort = chosen && columns.some((c) => c.key === chosen.key) ? chosen : fallback
  const col = columns.find((c) => c.key === sort.key)
  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort(a)
        const y = col.sort(b)
        if (x === y) return 0
        if (x === null || x === undefined) return 1
        if (y === null || y === undefined) return -1
        return (x > y ? 1 : -1) * sort.dir
      })
    : rows
  return (
    <div className="ins-board">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'right' : undefined} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button type="button" className="ins-sort" onClick={() => setChosen({ key: c.key, dir: sort.key === c.key ? -sort.dir : c.key === 'name' ? 1 : -1 })}>
                    {c.label}
                    <span aria-hidden="true">{sort.key === c.key ? (sort.dir > 0 ? '↑' : '↓') : ''}</span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="center-note">{empty}</td></tr>
          ) : (
            sorted.map((row) => (
              <tr key={row.key} className="table-plain-row">
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'right' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
