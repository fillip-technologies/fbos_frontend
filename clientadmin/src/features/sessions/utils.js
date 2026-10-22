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
