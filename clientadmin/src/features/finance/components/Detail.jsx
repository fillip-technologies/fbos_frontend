// One labelled value in a `.details-grid`; an empty value shows a dash.
export default function Detail({ label, children }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{empty ? <span className="muted">—</span> : children}</div>
    </div>
  )
}
