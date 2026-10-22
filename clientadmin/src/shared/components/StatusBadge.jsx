// The colour comes from the status code (`.badge.<status>` in styles.css); `label` is the
// words to show for it, when they differ from the code.
export default function StatusBadge({ status, label }) {
  const cls = (status || 'inactive').toLowerCase()
  return <span className={`badge ${cls}`}>{label || status || 'unknown'}</span>
}
