import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import NotificationBell, { NotificationLink } from '@/features/notifications/components/NotificationBell.jsx'
import { useUnreadCountPolling } from '@/features/notifications/hooks.js'
import CommandPalette, { rememberPage, shortcutLabel, usePaletteShortcut } from '@/app/layout/CommandPalette.jsx'
import { NAV_ITEMS, navItemFor, navSections } from '@/app/navigation.jsx'
import { preloadPage } from '@/app/pages.js'
import { PageSkeleton } from '@/shared/components/Skeleton.jsx'
import TopProgress from '@/shared/components/TopProgress.jsx'
import fillipMark from '@/assets/brand/fillip-mark.png'

const COLLAPSED_KEY = 'fbos_nav_collapsed'

const svg = (children, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const ICONS = {
  search: svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  chevron: svg(<path d="M9 6l6 6-6 6" />, 12),
  signOut: svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  menu: svg(<><path d="M4 7h16M4 12h16M4 17h10" /></>, 20),
  user: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  bell: svg(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
}

function Brand() {
  return (
    <div className="sidebar-brand">
      <img className="brand-mark" src={fillipMark} alt="" />
      <span className="brand-word">
        FBOS
        <small>by Fillip Technologies</small>
      </span>
    </div>
  )
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·'
}

function readCollapsed() {
  try {
    const list = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

const today = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

// The console's frame with placeholders, shown while the session is restored on load
// (a token refresh that can take a few seconds) so the page never sits blank.
export function LayoutSkeleton() {
  return (
    <div className="app-shell with-sidebar">
      <TopProgress />
      <aside className="sidebar" aria-hidden="true">
        <Brand />
        <div className="sidebar-nav">
          {[70, 55, 80, 62, 48, 74].map((w, i) => (
            <span key={i} className="skeleton sidebar-skeleton" style={{ width: `${w}%` }} />
          ))}
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
  const [palette, setPalette] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const mainRef = useRef(null)
  const firstRender = useRef(true)
  useUnreadCountPolling()
  usePaletteShortcut(setPalette)

  const items = useMemo(() => NAV_ITEMS.filter((item) => hasAccess(user, item.access)), [user])
  const sections = useMemo(() => navSections(items), [items])
  const current = navItemFor(items, location.pathname)
  const currentSection = current ? sections.find((s) => s.items.includes(current)) : null

  // Each navigation: close the drawer, start at the top, remember the page, and ease the new page in.
  useEffect(() => {
    setOpen(false)
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

  useEffect(() => {
    if (current) rememberPage(current.to)
  }, [current])

  function toggleSection(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        // Not remembered across visits; the toggle still works.
      }
      return next
    })
  }

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const extras = useMemo(
    () => [
      { id: 'profile', label: 'My profile', hint: 'Account', icon: ICONS.user, run: () => navigate('/profile') },
      { id: 'notifications', label: 'Notifications', hint: 'Account', icon: ICONS.bell, run: () => navigate('/notifications') },
      { id: 'signout', label: 'Sign out', hint: 'Account', icon: ICONS.signOut, run: handleLogout },
    ],
    [navigate, handleLogout],
  )

  const showHeaders = items.length > 6

  return (
    <div className={`app-shell with-sidebar${open ? ' sidebar-open' : ''}`}>
      <TopProgress />
      <aside className="sidebar" aria-label="Main navigation">
        <Brand />
        <button type="button" className="sidebar-search" onClick={() => setPalette(true)}>
          {ICONS.search}
          <span>Jump to…</span>
          <kbd>{shortcutLabel}</kbd>
        </button>
        <nav className="sidebar-nav">
          {sections.map((section) => {
            const isOpen = !showHeaders || section === currentSection || !collapsed.has(section.id)
            return (
              <div key={section.id} className={`nav-section${isOpen ? ' open' : ''}`}>
                {showHeaders && (
                  <button
                    type="button"
                    className="nav-section-head"
                    aria-expanded={isOpen}
                    onClick={() => toggleSection(section.id)}
                    onMouseEnter={() => section.items.forEach((i) => preloadPage(i.to))}
                  >
                    <span>{section.label}</span>
                    <span className="nav-section-count">{section.items.length}</span>
                    <span className="nav-section-chevron">{ICONS.chevron}</span>
                  </button>
                )}
                <div className="nav-section-items">
                  <div>
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className="sidebar-link"
                        tabIndex={isOpen ? undefined : -1}
                        onMouseEnter={() => preloadPage(item.to)}
                        onFocus={() => preloadPage(item.to)}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-user">
          <NavLink
            to="/profile"
            className="sidebar-user-name"
            onMouseEnter={() => preloadPage('/profile')}
            title={user ? `${user.name} · ${user.email}` : undefined}
          >
            <span className="sidebar-avatar" aria-hidden="true">
              {initials(user?.name)}
              {user && !user.mfa_enabled && <span className="sidebar-dot" title="Two-factor sign-in is off" />}
            </span>
            <span className="sidebar-user-text">
              <span>{user?.name || 'Profile'}</span>
              <small>{user?.organization?.name || user?.email}</small>
            </span>
          </NavLink>
          <NotificationBell />
          <button className="sidebar-signout" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            {ICONS.signOut}
          </button>
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={() => setOpen(false)} />

      <div className="content">
        <header className="pagebar">
          <button type="button" className="pagebar-menu" onClick={() => setOpen(true)} aria-label="Open menu">
            {ICONS.menu}
          </button>
          <nav className="crumbs" aria-label="You are here">
            {currentSection && showHeaders && <span className="crumb-section">{currentSection.label}</span>}
            <span className="crumb-page">{current?.label || (location.pathname.startsWith('/profile') ? 'My profile' : location.pathname.startsWith('/notifications') ? 'Notifications' : 'FBOS')}</span>
          </nav>
          <span className="spacer" />
          <span className="pagebar-date">{today.format(new Date())}</span>
          <button type="button" className="pagebar-search" onClick={() => setPalette(true)} aria-label="Jump to a page">
            {ICONS.search}
            <span>Search</span>
            <kbd>{shortcutLabel}</kbd>
          </button>
          <span className="pagebar-bell">
            <NotificationLink />
          </span>
        </header>
        <main className="container" ref={mainRef}>
          {/* The sidebar stays put while a page's code downloads. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {palette && <CommandPalette sections={sections} extras={extras} onClose={() => setPalette(false)} />}
    </div>
  )
}
