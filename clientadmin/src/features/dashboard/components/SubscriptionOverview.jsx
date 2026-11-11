import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { clientApi } from '@/features/dashboard/api.js'
import Overview from '@/features/dashboard/components/Overview.jsx'
import { HomeHero, Meter, WelcomeCard, Workspace } from '@/features/dashboard/components/HomeParts.jsx'
import NeedsYou from '@/features/dashboard/components/NeedsYou.jsx'
import { CREATE_ACTIONS } from '@/app/navigation.jsx'
import { hasAccess } from '@/features/auth/access.js'
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

  // No end date (the company that runs FBOS): no countdown, no expiry warning.
  const noExpiry = client.subscription_end == null
  const left = noExpiry ? null : daysUntil(client.subscription_end)
  const period = noExpiry ? null : periodUse(client.subscription_start, client.subscription_end)
  return (
    <div>
      <HomeHero
        eyebrow={
          <>
            {client.name}{' '}
            <StatusBadge
              status={client.subscription_state}
              label={client.subscription_state === 'unlimited' ? 'Unlimited · No expiry' : undefined}
            />
          </>
        }
        name={user?.name}
        sub="Workspace overview and every area of the console you can open."
      />

      {client.subscription_state === 'expiring' && (
        <div className="alert warn">
          Your service period ends on {formatDate(client.subscription_end)} ({left} day{left === 1 ? '' : 's'} left).
          Contact your administrator to extend it — all users are locked out once it ends.
        </div>
      )}

      <div className="cards">
        <div className="panel home-feature">
          <div className="stat-label">{noExpiry ? 'Service status' : 'Service period ends'}</div>
          <div className="stat-value">{noExpiry ? 'Unlimited' : formatDate(client.subscription_end)}</div>
          <div className="stat-sub">
            {noExpiry
              ? `Since ${formatDate(client.subscription_start)} · No expiry`
              : `${formatDate(client.subscription_start)} → ${formatDate(client.subscription_end)}`}
            {left !== null && left >= 0 && ` · ${left} day${left === 1 ? '' : 's'} left`}
          </div>
          {period && <Meter value={period.used} max={period.total} label="Share of the service period used" />}
        </div>
        <div className="panel">
          <div className="stat-label">Companies</div>
          <div className="stat-value">
            {orgCount} <span className="muted">/ {client.max_organizations ?? 'Unlimited'}</span>
          </div>
          <div className="stat-sub">
            <Link to="/organizations">Manage companies</Link>
          </div>
          {client.max_organizations != null && (
            <Meter value={orgCount} max={client.max_organizations} label="Companies used" />
          )}
        </div>
        <div className="panel">
          <div className="stat-label">Users per company</div>
          <div className="stat-value">
            {client.max_users_per_org == null ? (
              'Unlimited'
            ) : (
              <>
                <span className="muted">up to</span> {client.max_users_per_org}
              </>
            )}
          </div>
          <div className="stat-sub">
            <Link to="/users">Manage users</Link>
          </div>
        </div>
      </div>

      <WelcomeCard canCreate={CREATE_ACTIONS.some((a) => hasAccess(user, a.access))} />

      <NeedsYou />

      <Overview />

      <Workspace user={user} />
    </div>
  )
}
