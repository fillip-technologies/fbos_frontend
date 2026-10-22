import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

// What each area lets you do; shown only when the user's access allows that page.
const AREAS = [
  { to: '/users', label: 'Users', rule: ACCESS.users, text: 'See the people in your company and their access.' },
  { to: '/users/new', label: 'Invite a user', rule: ACCESS.inviteUsers, text: 'Add someone and choose what they can do.' },
  { to: '/org-units', label: 'Company structure', rule: ACCESS.orgUnits, text: 'Branches, departments and teams.' },
  { to: '/calendars', label: 'Working calendars', rule: ACCESS.calendars, text: 'Office hours and holidays.' },
  { to: '/roles', label: 'Roles', rule: ACCESS.roles, text: 'Ready-made sets of permissions.' },
  { to: '/audit-log', label: 'Security log', rule: ACCESS.auditLog, text: 'Sign-ins, failed attempts and sign-outs.' },
]

// Home page for organization users who aren't client administrators.
export default function MyHome() {
  const { user } = useAuth()
  const areas = AREAS.filter((a) => hasAccess(user, a.rule))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Welcome, {user.name.split(' ')[0]}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {user.organization.name}
            {user.home_unit && ` · ${user.home_unit.name}`}
          </p>
        </div>
      </div>

      {!user.mfa_enabled && (
        <div className="alert warn">
          Protect your account: <Link to="/profile">turn on two-factor sign-in</Link>.
        </div>
      )}

      {areas.length > 0 ? (
        <div className="cards">
          {areas.map((a) => (
            <Link key={a.to} to={a.to} className="panel area-card">
              <div className="stat-label">{a.label}</div>
              <div className="stat-sub">{a.text}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <h2>Nothing to manage here yet</h2>
          <p className="muted">
            Your account doesn't have access to any admin areas. If you need some, ask your administrator to grant it.
          </p>
        </div>
      )}

      <div className="panel form-section">
        <div className="section-head">
          <div>
            <h2>Your access</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              {user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'}. Your administrator manages these.
            </p>
          </div>
          <Link className="btn secondary" to="/profile">My profile</Link>
        </div>
        {user.roles.length > 0 && (
          <>
            <div className="detail-label">Role presets applied</div>
            <div className="chips">
              {user.roles.map((r, i) => (
                <span key={`${r.role_code}-${i}`} className="chip subtle">
                  {r.role_code} · {r.scope_unit ? `${r.scope_unit.name} and below` : 'whole company'}
                  {r.self_only ? ' · own records' : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
