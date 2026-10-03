import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { NAV_ITEMS } from '@/app/navigation.jsx'
import { USER_TYPE_LABELS } from '@/features/users/utils.js'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false) // off-canvas sidebar on small screens

  // Close the mobile drawer after navigating.
  useEffect(() => setOpen(false), [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const items = NAV_ITEMS.filter((item) => hasAccess(user, item.access))

  return (
    <div className={`app-shell with-sidebar${open ? ' sidebar-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          FBOS <small>Admin console</small>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="sidebar-link">
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-org">{USER_TYPE_LABELS[user?.user_type] || user?.user_type}</div>
          <div className="mono sidebar-user-email">{user?.email}</div>
          {user?.organization && <div className="sidebar-user-org">{user.organization.name}</div>}
          <NavLink to="/profile" className="sidebar-profile-link">
            My profile{user && !user.mfa_enabled && <span className="sidebar-dot" title="Two-factor sign-in is off" />}
          </NavLink>
          <button className="btn ghost" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={() => setOpen(false)} />

      <div className="content">
        <header className="mobile-bar">
          <button className="btn ghost" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <span className="brand">FBOS</span>
        </header>
        <main className="container">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
