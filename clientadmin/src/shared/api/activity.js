// Counts requests in flight so the UI can show one global progress bar. Plain JS:
// http.js reports, TopProgress listens.
let inFlight = 0
const listeners = new Set()

function emit() {
  for (const fn of listeners) fn(inFlight)
}

export function requestStarted() {
  inFlight += 1
  emit()
}

export function requestFinished() {
  inFlight = Math.max(0, inFlight - 1)
  emit()
}

export function onActivity(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function requestsInFlight() {
  return inFlight
}
