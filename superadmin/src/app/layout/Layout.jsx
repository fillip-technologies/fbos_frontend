import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  // Each navigation starts at the top and eases the new page in.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
    const main = mainRef.current
    if (!main?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    main.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="app-shell">
      <header className="sa-bar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-word">
            FBOS
            <small>Platform admin</small>
          </span>
        </div>
        <nav className="sa-nav" aria-label="Main navigation">
          <NavLink to="/clients">Clients</NavLink>
        </nav>
        <div className="sa-user">
          <span className="sidebar-user-text">
            <span>{user?.name}</span>
            <small className="mono">{user?.email}</small>
          </span>
          <span className="sidebar-avatar" aria-hidden="true">{initials || '·'}</span>
          <button className="sidebar-signout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>
      <main className="container" ref={mainRef}>
        <Outlet />
      </main>
    </div>
  )
}
