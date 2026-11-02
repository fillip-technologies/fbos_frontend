import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

// A small chart kit for the console, no library. Rules it keeps (see styles.css "Charts"):
// thin marks with 4px rounded data-ends, 2px surface gaps between touching marks, one y-axis,
// recessive hairline grid, a legend for two or more series, a hover tooltip that never holds
// the only copy of a value (every card has a table view), and text in ink, never series colors.

// Validated palettes (dataviz validator, light, on the white panel surface).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] // categorical, fixed order
export const ORDINAL = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'] // one hue, light → dark
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' }

const TooltipContext = createContext(null)

// ---------- Card: title, legend, chart or table ----------
export function ChartCard({ title, subtitle, legend, table, action, wide, children, className = '' }) {
  const [asTable, setAsTable] = useState(false)
  const [tip, setTip] = useState(null)
  const bodyRef = useRef(null)
  const show = useCallback((event, content) => {
    const box = bodyRef.current?.getBoundingClientRect()
    if (!box) return
    const point = event.touches?.[0] ?? event
    let x = point.clientX - box.left
    let y = point.clientY - box.top
    if (point.clientX === undefined) {
      // Keyboard focus: anchor to the focused mark.
      const mark = event.currentTarget.getBoundingClientRect()
      x = mark.left + mark.width / 2 - box.left
      y = mark.top - box.top
    }
    setTip({ x, y, content, flip: x > box.width * 0.6 })
  }, [])
  const hide = useCallback(() => setTip(null), [])

  return (
    <section className={`panel chart-card${wide ? ' wide' : ''} ${className}`}>
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="chart-sub">{subtitle}</p>}
        </div>
        <div className="chart-tools">
          {action}
          {table && (
            <div className="segmented chart-toggle" role="group" aria-label={`${title}: show as`}>
              <button type="button" className={asTable ? '' : 'active'} onClick={() => setAsTable(false)} aria-pressed={!asTable}>
                Chart
              </button>
              <button type="button" className={asTable ? 'active' : ''} onClick={() => setAsTable(true)} aria-pressed={asTable}>
                Table
              </button>
            </div>
          )}
        </div>
      </header>
      {legend && !asTable && <Legend items={legend} />}
      <div className="chart-body" ref={bodyRef} onPointerLeave={hide}>
        {asTable && table ? (
          <DataTable {...table} />
        ) : (
          <TooltipContext.Provider value={{ show, hide }}>{children}</TooltipContext.Provider>
        )}
        {tip && !asTable && (
          <div className={`chart-tip${tip.flip ? ' flip' : ''}`} style={{ left: tip.x, top: tip.y }} role="status">
            {tip.content}
          </div>
        )}
      </div>
    </section>
  )
}

// Hover + focus handlers for a mark: the tooltip shows `content` (a node).
function useTip(content) {
  const ctx = useContext(TooltipContext)
  if (!ctx) return {}
  return {
    tabIndex: 0,
    onPointerMove: (e) => ctx.show(e, content),
    onFocus: (e) => ctx.show(e, content),
    onBlur: ctx.hide,
  }
}

// Tooltip body: value first and strong, the name after; a short line keys the series.
export function TipRows({ title, rows }) {
  return (
    <>
      {title && <div className="tip-title">{title}</div>}
      {rows.map((r) => (
        <div key={r.label} className="tip-row">
          {r.color && <span className="tip-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </>
  )
}

export function Legend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`legend-key ${item.shape || 'rect'}`} style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function DataTable({ columns, rows }) {
  return (
    <div className="chart-table">
      <table className="compact table-plain">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={i > 0 ? 'right' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={i > 0 ? 'right' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A bar's width as a share of its track, keeping room at the end for the value label,
// so the longest bar's value never runs into the next column or out of the card.
const LABEL_ROOM = 72
function barWidth(share, nonZero) {
  const s = Math.max(0, Math.min(1, share))
  if (!nonZero) return 0
  return `max(4px, calc(${s * 100}% - ${s * LABEL_ROOM}px))`
}

// ---------- Horizontal bars: one series, value at the tip ----------
export function BarList({ rows, color = SERIES[0], colors, format = String, emptyText = 'Nothing yet.', fill = false }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (!rows.length || max === 0) return <p className="chart-empty">{emptyText}</p>
  return (
    <ul className={`bar-list${fill ? ' fill' : ''}`}>
      {rows.map((row, i) => (
        <BarRow key={row.key ?? row.label} row={row} share={row.value / max} color={colors?.[i] ?? row.color ?? color} format={format} />
      ))}
    </ul>
  )
}

function BarRow({ row, share, color, format }) {
  const tip = useTip(<TipRows title={row.label} rows={[{ label: row.tipLabel || 'Total', value: format(row.value), color }]} />)
  return (
    <li className="bar-row" {...tip} aria-label={`${row.label}: ${format(row.value)}`}>
      <span className="bar-label" title={row.label}>
        {row.label}
      </span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: barWidth(share, row.value > 0), background: color }} />
        <span className="bar-value">{format(row.value)}</span>
      </span>
      {row.sub && <span className="bar-sub">{row.sub}</span>}
    </li>
  )
}

// ---------- Tall segmented bar: one whole, split into parts ----------
export function SegmentedBar({ parts, format = String, label }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return <p className="chart-empty">Nothing yet.</p>
  const name = `${label || 'Total'} ${format(total)}: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}`
  return (
    <div className="seg-bar" role="img" aria-label={name}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <Segment key={p.label} part={p} share={p.value / total} format={format} />
        ))}
    </div>
  )
}

function Segment({ part, share, format }) {
  const tip = useTip(<TipRows title={part.label} rows={[{ label: `${Math.round(share * 100)}% of the whole`, value: format(part.value), color: part.color }]} />)
  const pct = Math.round(share * 100)
  return (
    <span className="seg" style={{ flexGrow: share, background: part.color, color: part.ink || '#fff' }} {...tip}>
      {share >= 0.09 && <span className="seg-label">{pct}%</span>}
    </span>
  )
}

// ---------- Stacked rows: per person (or team), parts side by side ----------
export function StackedRows({ rows, keys, format = String, aside }) {
  const max = Math.max(0, ...rows.map((r) => keys.reduce((s, k) => s + (r.parts[k.key] || 0), 0)))
  if (!rows.length || max === 0) return <p className="chart-empty">Nothing open right now.</p>
  return (
    <div className="stack-rows">
      {aside && (
        <div className="stack-row stack-head" aria-hidden="true">
          <span />
          <span />
          {aside.map((a) => (
            <span key={a.label} className="stack-aside-head">
              {a.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((row) => (
        <StackRow key={row.key} row={row} keys={keys} max={max} format={format} aside={aside} />
      ))}
    </div>
  )
}

function StackRow({ row, keys, max, format, aside }) {
  const total = keys.reduce((s, k) => s + (row.parts[k.key] || 0), 0)
  const tip = useTip(
    <TipRows
      title={row.label}
      rows={[
        ...keys.filter((k) => row.parts[k.key]).map((k) => ({ label: k.label, value: format(row.parts[k.key]), color: k.color })),
        ...(aside || []).map((a) => ({ label: a.label, value: a.render(row) })),
      ]}
    />,
  )
  return (
    <div className="stack-row" {...tip} aria-label={`${row.label}: ${format(total)} open`}>
      <span className="bar-label" title={row.label}>
        {row.avatar}
        {row.label}
      </span>
      <span className="stack-track">
        <span className="stack-bar" style={{ width: barWidth(total / max, total > 0) }}>
          {keys.map((k) =>
            row.parts[k.key] ? <span key={k.key} className="stack-part" style={{ flexGrow: row.parts[k.key], background: k.color }} /> : null,
          )}
        </span>
        <span className="bar-value">{format(total)}</span>
      </span>
      {aside?.map((a) => (
        <span key={a.label} className="stack-aside">
          {a.render(row)}
        </span>
      ))}
    </div>
  )
}

// ---------- Plots with axes (columns, lines) ----------
// The plot's box. With `height="fill"` a plot takes the room its card leaves it (cards in a row
// share one height), so the chart grows instead of leaving a gap under it.
function useBox() {
  const ref = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setBox({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, box]
}
const FILL_MIN = 180

// Clean ticks from 0 to the max: 0 / 1 / 2 / 5 × 10^n steps.
function ticks(max, count = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || pow * 10
  const out = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step)
  return out
}

const PAD = { top: 12, right: 12, bottom: 28, left: 52 }

// Grouped columns: categories along x, one column per series, one y-axis.
export function ColumnChart({ categories, series, format = String, axisFormat = format, height: wanted = 220 }) {
  const [ref, box] = useBox()
  const fill = wanted === 'fill'
  const width = box.width
  const height = fill ? Math.max(FILL_MIN, box.height) : wanted
  const id = useId()
  const ctx = useContext(TooltipContext)
  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const yt = ticks(max)
  const top = yt[yt.length - 1] || 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const band = categories.length ? plotW / categories.length : 0
  const barW = Math.min(24, Math.max(4, (band * 0.7 - (series.length - 1) * 2) / series.length))
  const groupW = series.length * barW + (series.length - 1) * 2
  const y = (v) => PAD.top + plotH - (v / top) * plotH
  // Every k-th category label, so labels never collide (the tooltip and table name every one).
  const every = Math.max(1, Math.ceil(categories.length / Math.max(1, Math.floor(plotW / 56))))

  return (
    <div className={`plot${fill ? ' fill' : ''}`} ref={ref} style={fill ? undefined : { height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{series.map((s) => s.label).join(' and ')} by {categories.length} periods</title>
          {yt.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="axis" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          <line className="baseline" x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} />
          {categories.map((c, ci) => {
            const x0 = PAD.left + ci * band + (band - groupW) / 2
            const tipBody = <TipRows title={c.title || c.label} rows={series.map((s) => ({ label: s.label, value: format(s.values[ci]), color: s.color }))} />
            return (
              <g
                key={c.key}
                className="col-group"
                tabIndex={0}
                onPointerMove={(e) => ctx?.show(e, tipBody)}
                onFocus={(e) => ctx?.show(e, tipBody)}
                onBlur={ctx?.hide}
              >
                <rect className="hit" x={PAD.left + ci * band} y={PAD.top} width={band} height={plotH} />
                {series.map((s, si) => {
                  const v = s.values[ci] || 0
                  const h = Math.max(0, y(0) - y(v))
                  return h > 0 ? (
                    <path key={s.key} d={columnPath(x0 + si * (barW + 2), y(v), barW, h)} fill={s.color} className="col" />
                  ) : null
                })}
                {(ci % every === 0 || ci === categories.length - 1) && (
                  <text className="axis" x={PAD.left + ci * band + band / 2} y={height - 8} textAnchor="middle">
                    {c.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// A column with a 4px rounded top, square at the baseline.
function columnPath(x, top, w, h) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`
}

// Lines over time with a crosshair that snaps to the nearest point.
export function LineChart({ categories, series, format = String, axisFormat = format, height: wanted = 220 }) {
  const [ref, box] = useBox()
  const fill = wanted === 'fill'
  const width = box.width
  const height = fill ? Math.max(FILL_MIN, box.height) : wanted
  const id = useId()
  const ctx = useContext(TooltipContext)
  const [hover, setHover] = useState(null)
  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const yt = ticks(max)
  const top = yt[yt.length - 1] || 1
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const n = categories.length
  const x = (i) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v) => PAD.top + plotH - (v / top) * plotH
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 64))))

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - box.left - PAD.left
    const i = Math.max(0, Math.min(n - 1, Math.round((rel / Math.max(1, plotW)) * (n - 1))))
    setHover(i)
    ctx?.show(e, <TipRows title={categories[i].title || categories[i].label} rows={series.map((s) => ({ label: s.label, value: format(s.values[i]), color: s.color }))} />)
  }

  return (
    <div className={`plot${fill ? ' fill' : ''}`} ref={ref} style={fill ? undefined : { height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-t`}
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(null)
            ctx?.hide()
          }}
        >
          <title id={`${id}-t`}>{series.map((s) => s.label).join(' and ')} over {n} periods</title>
          {yt.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="axis" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          <line className="baseline" x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} />
          {categories.map((c, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={c.key} className="axis" x={x(i)} y={height - 8} textAnchor="middle">
                {c.label}
              </text>
            ) : null,
          )}
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} />}
          {series.map((s) => (
            <g key={s.key}>
              <path d={`M${s.values.map((v, i) => `${x(i)},${y(v || 0)}`).join(' L')}`} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] || 0)} r="4" fill={s.color} className="end-dot" />
              {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover] || 0)} r="4.5" fill={s.color} className="end-dot" />}
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

// ---------- Ring meter: one share of a whole (utilization, progress) ----------
export function Ring({ value, max = 100, size = 44, color = SERIES[0], label }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeDasharray={`${share * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-fill"
      />
    </svg>
  )
}

// Counts up to a number when it first shows (skipped with reduced motion).
export function useCountUp(target, duration = 700) {
  const [shown, setShown] = useState(target)
  const from = useRef(0)
  useEffect(() => {
    if (!Number.isFinite(target)) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(target)
      return undefined
    }
    const start = performance.now()
    const begin = from.current
    let frame
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setShown(begin + (target - begin) * eased)
      if (t < 1) frame = requestAnimationFrame(step)
      else from.current = target
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return shown
}
