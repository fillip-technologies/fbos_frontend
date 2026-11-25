import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import Overview from '@/features/dashboard/components/Overview.jsx'
import ChecklistsCard from '@/features/dashboard/components/ChecklistsCard.jsx'
import NeedsYou from '@/features/dashboard/components/NeedsYou.jsx'
import { HomeHero, WelcomeCard, Workspace } from '@/features/dashboard/components/HomeParts.jsx'
import { CREATE_ACTIONS, NAV_ITEMS } from '@/app/navigation.jsx'

// Home page for organization users who aren't client administrators.
export default function MyHome() {
  const { user } = useAuth()
  const canOpenAnything = NAV_ITEMS.some((item) => item.to !== '/' && hasAccess(user, item.access))
  const where = [user.organization?.name, user.home_unit?.name].filter(Boolean).join(' · ')

  return (
    <div>
      <HomeHero eyebrow={where || 'Your workspace'} name={user.name} sub="What needs you first, then how things are going. Press / anywhere to find a page.">
        <div className="row-actions home-actions">
          {hasAccess(user, ACCESS.ceoDashboard) && <Link className="btn" to="/ceo">CEO Command Center</Link>}
          {hasAccess(user, ACCESS.inviteUsers) && <Link className="btn secondary" to="/users/new">Invite a user</Link>}
          <Link className="btn secondary" to="/profile">My profile</Link>
        </div>
      </HomeHero>

      {!user.mfa_enabled && (
        <div className="alert warn">
          Protect your account: <Link to="/profile">turn on two-factor sign-in</Link>.
        </div>
      )}

      <NeedsYou />

      <ChecklistsCard />

      <Overview />

      <WelcomeCard canCreate={CREATE_ACTIONS.some((a) => hasAccess(user, a.access))} />

      {canOpenAnything ? (
        <Workspace user={user} />
      ) : (
        <div className="panel empty-state">
          <h2>Nothing to manage here yet</h2>
          <p className="muted">
            Your account doesn't have access to any admin areas. If you need some, ask your administrator to grant it.
          </p>
        </div>
      )}

      <details className="home-section home-fold">
        <summary className="home-section-head">
          <h2>Your access</h2>
          <span>
            {user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'} · managed by your administrator
          </span>
        </summary>
        <div className="panel">
          <div className="section-head">
            <div>
              <div className="detail-label">Role presets applied</div>
              {user.roles.length > 0 ? (
                <div className="chips">
                  {user.roles.map((r, i) => (
                    <span key={`${r.role_code}-${i}`} className="chip subtle">
                      {r.role_code} · {r.scope_unit ? `${r.scope_unit.name} and below` : 'whole company'}
                      {r.self_only ? ' · own records' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted small" style={{ margin: '4px 0 0' }}>No role presets — your access was given one permission at a time.</p>
              )}
            </div>
            <Link className="btn secondary" to="/profile">My profile</Link>
          </div>
        </div>
      </details>
    </div>
  )
}
