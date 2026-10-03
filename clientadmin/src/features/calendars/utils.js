// Working calendars. `weekly_hours` is stored as { mon: [["09:00", "17:00"], ...], ... }:
// each working day maps to one or more time ranges (several when there is a break);
// a day that is missing or empty is a day off.

export const DAYS = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
]

const week = (days, ranges) => Object.fromEntries(DAYS.map((d) => [d.key, days.includes(d.key) ? ranges.map((r) => [...r]) : []]))

export const WEEK_PRESETS = [
  { label: 'Mon–Fri, 9:00–18:00', hours: week(['mon', 'tue', 'wed', 'thu', 'fri'], [['09:00', '18:00']]) },
  { label: 'Mon–Fri, 9:30–18:30 with lunch', hours: week(['mon', 'tue', 'wed', 'thu', 'fri'], [['09:30', '13:30'], ['14:30', '18:30']]) },
  { label: 'Mon–Sat, 10:00–19:00', hours: week(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], [['10:00', '19:00']]) },
]

// Problems with one day's ranges, or null. Times are "HH:MM", so string comparison works.
export function dayError(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [start, end] of sorted) {
    if (!start || !end) return 'Enter both a start and an end time.'
    if (end <= start) return `${start}–${end}: the end must be after the start.`
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] < sorted[i - 1][1]) return 'Time ranges overlap.'
  }
  return null
}

// The non-empty days only, ranges sorted — what gets sent to the backend.
export function cleanWeek(hours) {
  return Object.fromEntries(
    DAYS.filter((d) => hours[d.key]?.length).map((d) => [d.key, [...hours[d.key]].sort((a, b) => a[0].localeCompare(b[0]))])
  )
}

const rangesText = (ranges) => ranges.map(([s, e]) => `${s}–${e}`).join(', ')

// "Mon–Fri 09:00–18:00 · Sat 10:00–14:00": consecutive days with the same hours are grouped.
export function summarizeWeek(hours) {
  if (!hours) return 'No working hours set'
  const groups = []
  for (const d of DAYS) {
    const ranges = hours[d.key] || []
    if (!ranges.length) continue
    const text = rangesText(ranges)
    const last = groups[groups.length - 1]
    const prevIndex = last ? DAYS.findIndex((x) => x.key === last.to) : -2
    if (last && last.text === text && DAYS[prevIndex + 1]?.key === d.key) last.to = d.key
    else groups.push({ from: d.key, to: d.key, text })
  }
  if (!groups.length) return 'No working days'
  const short = (k) => DAYS.find((d) => d.key === k).short
  return groups.map((g) => `${g.from === g.to ? short(g.from) : `${short(g.from)}–${short(g.to)}`} ${g.text}`).join(' · ')
}

// IANA zones from the browser, with a short fallback for browsers that lack the API.
export function timezones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York']
  }
}
