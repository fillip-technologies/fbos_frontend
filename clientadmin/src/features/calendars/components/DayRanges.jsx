// One day's working time as time ranges (several when there is a break), each with a start and
// an end. Used for a weekday of a new calendar and for an extra working day.
export default function DayRanges({ ranges, onChange, label, children }) {
  const setRange = (i, pos, value) => onChange(ranges.map((r, j) => (j === i ? (pos === 0 ? [value, r[1]] : [r[0], value]) : r)))
  return (
    <div className="week-ranges">
      {ranges.map((r, i) => (
        <span key={i} className="week-range">
          <input type="time" value={r[0]} onChange={(e) => setRange(i, 0, e.target.value)} aria-label={`${label} start`} required />
          <span className="muted">–</span>
          <input type="time" value={r[1]} onChange={(e) => setRange(i, 1, e.target.value)} aria-label={`${label} end`} required />
          {ranges.length > 1 && (
            <button type="button" className="link-btn danger" onClick={() => onChange(ranges.filter((_, j) => j !== i))} aria-label="Remove time range">✕</button>
          )}
        </span>
      ))}
      {ranges.length > 0 && (
        <button type="button" className="link-btn" onClick={() => onChange([...ranges, [ranges[ranges.length - 1][1], '18:00']])}>
          + Add range
        </button>
      )}
      {children}
    </div>
  )
}
