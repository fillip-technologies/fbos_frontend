import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import NotificationBell, { NotificationLink } from '@/features/notifications/components/NotificationBell.jsx'
import { useUnreadCountPolling } from '@/features/notifications/hooks.js'
import { NAV_ITEMS } from '@/app/navigation.jsx'
import { preloadPage } from '@/app/pages.js'
import { PageSkeleton } from '@/shared/components/Skeleton.jsx'
import TopProgress from '@/shared/components/TopProgress.jsx'

// The console's frame with placeholders, shown while the session is restored on load
// (a token refresh that can take a few seconds) so the page never sits blank.
export function LayoutSkeleton() {
  return (
    <div className="app-shell with-sidebar">
      <TopProgress />
      <aside className="sidebar" aria-hidden="true">
        <div className="sidebar-brand">
          FBOS <small>Admin console</small>
        </div>
      </aside>
      <div className="content">
        <main className="container">
          <PageSkeleton />
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false) // off-canvas sidebar on small screens
  useUnreadCountPolling()

  // Close the mobile drawer after navigating.
  useEffect(() => setOpen(false), [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const items = NAV_ITEMS.filter((item) => hasAccess(user, item.access))

  return (
    <div className={`app-shell with-sidebar${open ? ' sidebar-open' : ''}`}>
      <TopProgress />
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          FBOS <small>Admin console</small>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="sidebar-link"
              onMouseEnter={() => preloadPage(item.to)}
              onFocus={() => preloadPage(item.to)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <NavLink to="/profile" className="sidebar-user-name" onMouseEnter={() => preloadPage('/profile')} title={user ? `${user.name} · ${user.email}` : undefined}>
            <span>Profile</span>
            {user && !user.mfa_enabled && <span className="sidebar-dot" title="Two-factor sign-in is off" />}
          </NavLink>
          <NotificationBell />
          <button className="sidebar-signout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
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
          <NotificationLink />
        </header>
        <main className="container">
          {/* The sidebar stays put while a page's code downloads. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
