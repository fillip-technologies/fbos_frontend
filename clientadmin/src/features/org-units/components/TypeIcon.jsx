// A drawing for each kind of unit (and the company itself), shared by the chart and the new-unit form.
const ICONS = {
  company: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 9h5a1 1 0 0 1 1 1v11" /><path d="M8 8h2M8 12h2M8 16h2" /></>,
  branch: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6M9 11h.01M15 11h.01" /></>,
  department: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" /></>,
  team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 15c3 0 6 1.5 6 5" /></>,
}

export default function TypeIcon({ type, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[type] ?? ICONS.team}
    </svg>
  )
}
