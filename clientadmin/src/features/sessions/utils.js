// Presentation helpers for sessions and sign-in activity.

// Checked in order: Edge and Opera also say "Chrome", Chrome also says "Safari",
// iPhones also say "Mac OS X" and Android also says "Linux".
const BROWSERS = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SYSTEMS = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/126.0 Safari/537.36" -> "Chrome on Windows"
export function describeDevice(userAgent) {
  if (!userAgent || userAgent === 'Unknown') return 'Unknown device'
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1]
  if (browser && system) return `${browser} on ${system}`
  return browser || system || userAgent.split(/[\s/]/)[0]
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const STEPS = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [Infinity, 'week'],
]

// ISO timestamp -> "5 minutes ago", "yesterday", …
export function timeAgo(iso) {
  let value = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(value)) return '—'
  if (Math.abs(value) < 45) return 'just now'
  for (const [size, unit] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return '—'
}
