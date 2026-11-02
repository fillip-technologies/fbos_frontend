import { Children } from 'react'

// Dashboards are laid out as sections of rows. A row is twelve columns wide; its cards share
// one height (charts and lists inside fill it), so cards of different content never leave gaps.

export function Section({ title, sub, children }) {
  return (
    <section className="ov-section">
      {title && (
        <div className="ov-section-head">
          <h3>{title}</h3>
          {sub && <span>{sub}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

// `spans`: twelfths per card, in order. Cards left out (null / false) close up, and a row left
// with one card gives it the full width.
export function Row({ spans = [6, 6], children }) {
  const items = Children.toArray(children)
  if (!items.length) return null
  return (
    <div className="ov-row">
      {items.map((child, i) => (
        <div key={child.key ?? i} className="ov-cell" style={{ '--span': items.length === 1 ? 12 : spans[i] ?? 6 }}>
          {child}
        </div>
      ))}
    </div>
  )
}
