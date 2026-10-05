import { useDelayedFlag } from '@/shared/utils/useDelayedFlag.js'

// Placeholders shown while data or a page's code is loading. Each waits ~200 ms before
// appearing, so quick loads go straight from nothing to content without a flash.

const WIDTHS = ['72%', '55%', '84%', '40%', '64%', '48%']

function Bar({ width = '100%', height = 12, style }) {
  return <span className="skeleton" style={{ width, height, ...style }} />
}

// Rows for a table body: `<tbody>{loading ? <TableSkeleton cols={7} /> : rows}</tbody>`.
export function TableSkeleton({ cols, rows = 8 }) {
  const shown = useDelayedFlag(true)
  if (!shown) {
    return (
      <tr aria-busy="true">
        <td colSpan={cols} className="skeleton-wait" />
      </tr>
    )
  }
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden={r > 0 || undefined} aria-busy={r === 0 || undefined}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}>
          <Bar width={WIDTHS[(r + c) % WIDTHS.length]} />
        </td>
      ))}
    </tr>
  ))
}

function Lines({ lines }) {
  return (
    <div className="panel skeleton-panel">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line">
          <Bar width={110} />
          <Bar width={WIDTHS[i % WIDTHS.length]} />
        </div>
      ))}
    </div>
  )
}

// A detail page: heading plus a panel of label / value lines.
export function DetailSkeleton({ lines = 6 }) {
  const shown = useDelayedFlag(true)
  if (!shown) return <div className="skeleton-wait" aria-busy="true" />
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <Bar width={220} height={22} />
          <Bar width={160} style={{ marginTop: 10 }} />
        </div>
      </div>
      <Lines lines={lines} />
    </div>
  )
}

// Panels inside a page that already shows its heading (cards, settings sections).
export function PanelSkeleton({ panels = 1, lines = 4 }) {
  const shown = useDelayedFlag(true)
  if (!shown) return <div className="skeleton-wait" aria-busy="true" />
  return (
    <div aria-busy="true" aria-label="Loading" className="skeleton-stack">
      {Array.from({ length: panels }, (_, i) => (
        <Lines key={i} lines={lines} />
      ))}
    </div>
  )
}

// Suspense fallback while a page's code downloads.
export function PageSkeleton() {
  return <DetailSkeleton lines={5} />
}
