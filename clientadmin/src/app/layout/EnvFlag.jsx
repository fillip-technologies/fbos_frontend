// A small flag that says which environment this console talks to, so nobody mistakes it.
// - A build made for staging sets VITE_APP_ENV=staging and shows "STAGING".
// - The dev server proxies /api to API_URL (vite.config.js passes it as __API_TARGET__). When that is a
//   real server and not this machine, the flag says "Connected to <host>: changes are real", because
//   development and production share the same databases today.
// Nothing shows on a normal production build or when the dev server points at local services.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1']

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export default function EnvFlag() {
  const label = (import.meta.env.VITE_APP_ENV || '').trim().toLowerCase()
  if (label === 'staging') {
    return <div className="env-flag staging" role="status">STAGING · test data only</div>
  }
  // The red "Connected to <host> · changes here are real" pill is switched off at the user's request.
  // To bring it back, set VITE_SHOW_LIVE_FLAG=true.
  if (import.meta.env.VITE_SHOW_LIVE_FLAG !== 'true') return null
  const target = typeof __API_TARGET__ === 'string' ? __API_TARGET__ : ''
  const host = hostOf(target)
  if (import.meta.env.DEV && host && !LOCAL_HOSTS.includes(host)) {
    return <div className="env-flag live" role="status">Connected to {host} · changes here are real</div>
  }
  return null
}
