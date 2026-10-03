import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CONSOLE, useAuth } from '../auth/AuthContext.jsx'

const NAV = {
  [CONSOLE.CLIENT]: [{ to: '/organizations', label: 'Organizations' }],
  [CONSOLE.ORGANIZATION]: [
    { to: '/overview', label: 'Overview' },
    { to: '/members', label: 'Members' },
  ],
}

export default function Layout() {
  const { user, consoleType, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            FBOS{' '}
            <small>
              {consoleType === CONSOLE.CLIENT ? 'Client console' : user?.organization?.name}
            </small>
          </div>
          <nav className="nav">
            {(NAV[consoleType] || []).map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="user">
          <span>
            {user?.name} · <span className="mono">{user?.email}</span>
          </span>
          <button className="btn ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
