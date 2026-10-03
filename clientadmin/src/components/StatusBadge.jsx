export default function StatusBadge({ status }) {
  const cls = (status || 'inactive').toLowerCase()
  return <span className={`badge ${cls}`}>{status || 'unknown'}</span>
}
