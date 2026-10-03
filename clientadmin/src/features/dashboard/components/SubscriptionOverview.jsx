import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clientApi } from '@/features/dashboard/api.js'
import { organizationsApi } from '@/features/organizations/api.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { daysUntil, formatDate } from '@/shared/utils/format.js'

// Client admins: the client's service period and quotas (/clients/me is client-admin only).
export default function SubscriptionOverview() {
  const [client, setClient] = useState(null)
  const [orgCount, setOrgCount] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([clientApi.me(), organizationsApi.list({ limit: 100 })])
      .then(([c, orgs]) => {
        setClient(c)
        setOrgCount(orgs.data.filter((o) => o.status !== 'deleted').length)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <div className="center-note">Loading…</div>
  if (error && !client) return <ErrorBanner error={error} onRetry={load} />

  const left = daysUntil(client.subscription_end)
  return (
    <div>
      <div className="page-head">
        <h1>{client.name}</h1>
        <StatusBadge status={client.subscription_state} />
      </div>

      {client.subscription_state === 'expiring' && (
        <div className="alert warn">
          Your subscription ends on {formatDate(client.subscription_end)} ({left} day{left === 1 ? '' : 's'} left).
          Contact the platform admin to renew before then — all users are locked out once it ends.
        </div>
      )}

      <div className="cards">
        <div className="panel">
          <div className="stat-label">Service period</div>
          <div className="stat-value">{formatDate(client.subscription_end)}</div>
          <div className="stat-sub">
            {formatDate(client.subscription_start)} → {formatDate(client.subscription_end)}
            {left !== null && left >= 0 && ` · ${left} day${left === 1 ? '' : 's'} left`}
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">Companies</div>
          <div className="stat-value">
            {orgCount} / {client.max_organizations}
          </div>
          <div className="stat-sub">
            <Link to="/organizations">Manage companies</Link>
          </div>
        </div>
        <div className="panel">
          <div className="stat-label">Users per company</div>
          <div className="stat-value">up to {client.max_users_per_org}</div>
          <div className="stat-sub">
            <Link to="/users">Manage users</Link>
          </div>
        </div>
      </div>
      <p className="muted">Subscription dates and quotas are set by the platform administrator.</p>
    </div>
  )
}
