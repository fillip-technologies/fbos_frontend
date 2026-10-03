import { useAuth } from '../../auth/AuthContext.jsx'

function scopeLabel(role) {
  if (role.self_only) return 'self only'
  if (role.scope_unit) return `unit: ${role.scope_unit.name}`
  if (role.scope_vertical) return `vertical: ${role.scope_vertical.name}`
  return 'whole organization'
}

// Everything here comes from /auth/me (returned with the login/refresh), which
// is all an organization user may read about their organization: the
// /organizations endpoints are reserved for client admins.
export default function Overview() {
  const { user } = useAuth()
  const org = user.organization

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{org.name}</h1>
      </div>

      <section className="panel">
        <h2 className="panel-title">Organization</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{org.name}</dd>
          <dt>Code</dt>
          <dd className="mono">{org.code}</dd>
          <dt>ID</dt>
          <dd className="mono">{org.id}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2 className="panel-title">Your profile</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Account type</dt>
          <dd>{user.user_type.replace(/_/g, ' ')}</dd>
          <dt>Home unit</dt>
          <dd>{user.home_unit?.name || <span className="muted">—</span>}</dd>
          <dt>Two-factor</dt>
          <dd>{user.mfa_enabled ? 'Enabled' : 'Not enabled'}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2 className="panel-title">Roles &amp; permissions</h2>
        {user.roles.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No roles assigned yet.</p>
        ) : (
          <>
            <div className="chips" style={{ marginBottom: 16 }}>
              {user.roles.map((role, i) => (
                <span key={`${role.role_code}-${i}`} className="chip">
                  <strong>{role.role_code}</strong> <span className="muted">· {scopeLabel(role)}</span>
                </span>
              ))}
            </div>
            <div className="chips">
              {user.permissions.map((p) => (
                <span key={p} className="chip mono">
                  {p}
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
