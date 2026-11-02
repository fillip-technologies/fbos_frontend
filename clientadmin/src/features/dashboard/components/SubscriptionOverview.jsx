import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { clientApi } from '@/features/dashboard/api.js'
import Overview from '@/features/dashboard/components/Overview.jsx'
import { HomeHero, Meter, Workspace } from '@/features/dashboard/components/HomeParts.jsx'
import { organizationsApi } from '@/features/organizations/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { daysUntil, formatDate } from '@/shared/utils/format.js'

// Days of the service period already used, as { used, total }; null when the dates don't parse.
function periodUse(start, end) {
  const from = Date.parse(start)
  const to = Date.parse(end)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null
  const day = 86_400_000
  return { used: Math.max(0, Math.min(to - from, Date.now() - from)) / day, total: (to - from) / day }
}

// Client admins: the client's service period and quotas (/clients/me is client-admin only).
export default function SubscriptionOverview() {
  const { user } = useAuth()
  const clientQuery = useQuery(['client', null, 'me'], ({ signal }) => clientApi.me({ signal }))
  // Same request as the organization switcher's, so it is answered from the cache.
  const orgsQuery = useQuery(['organizations', 'switcher'], ({ signal }) => organizationsApi.list({ limit: 100 }, { signal }), {
    staleTime: 5 * 60_000,
  })
  const client = clientQuery.data
  const orgCount = orgsQuery.data ? orgsQuery.data.data.filter((o) => o.status !== 'deleted').length : null
  const error = clientQuery.error || orgsQuery.error
  const reload = () => {
    clientQuery.reload()
    orgsQuery.reload()
  }

  if (error && !client) return <ErrorBanner error={error} onRetry={reload} />
  if (clientQuery.loading || orgsQuery.loading) return <DetailSkeleton />

  const left = daysUntil(client.subscription_end)
  const period = periodUse(client.subscription_start, client.subscription_end)
  return (
    <div>
      <HomeHero
        eyebrow={
          <>
            {client.name} <StatusBadge status={client.subscription_state} />
          </>
        }
        name={user?.name}
        sub="Your subscription at a glance, and every area of the console you can open."
      />

      {client.subscription_state === 'expiring' && (
        <div className="alert warn">
          Your subscription ends on {formatDate(client.subscription_end)} ({left} day{left === 1 ? '' : 's'} left).
          Contact the platform admin to renew before then — all users are locked out once it ends.
        </div>
      )}

      <div className="cards">
        <div className="panel home-feature">
          <div className="stat-label">Service period ends</div>
          <div className="stat-value">{formatDate(client.subscription_end)}</div>
          <div className="stat-sub">
            {formatDate(client.subscription_start)} → {formatDate(client.subscription_end)}
            {left !== null && left >= 0 && ` · ${left} day${left === 1 ? '' : 's'} left`}
          </div>
          {period && <Meter value={period.used} max={period.total} label="Share of the service period used" />}
        </div>
        <div className="panel">
          <div className="stat-label">Companies</div>
          <div className="stat-value">
            {orgCount} <span className="muted">/ {client.max_organizations}</span>
          </div>
          <div className="stat-sub">
            <Link to="/organizations">Manage companies</Link>
          </div>
          <Meter value={orgCount} max={client.max_organizations} label="Companies used" />
        </div>
        <div className="panel">
          <div className="stat-label">Users per company</div>
          <div className="stat-value">
            <span className="muted">up to</span> {client.max_users_per_org}
          </div>
          <div className="stat-sub">
            <Link to="/users">Manage users</Link>
          </div>
        </div>
      </div>
      <p className="muted small">Subscription dates and quotas are set by the platform administrator.</p>

      <Overview />

      <Workspace user={user} />
    </div>
  )
}
