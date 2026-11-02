import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NAV_ITEMS, navSections } from '@/app/navigation.jsx'
import { preloadPage } from '@/app/pages.js'
import { hasAccess } from '@/features/auth/access.js'

function partOfDay(hour) {
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

// The top of the home page: who, where, and the time.
export function HomeHero({ eyebrow, name, title, sub, children }) {
  const now = useNow()
  const first = name?.trim().split(/\s+/)[0]
  return (
    <header className="home-hero">
      <div>
        <div className="home-eyebrow">{eyebrow}</div>
        <h1 className="home-title">
          {title ?? (
            <>
              {partOfDay(now.getHours())}
              {first ? <>, <em>{first}.</em></> : '.'}
            </>
          )}
        </h1>
        {sub && <p className="home-sub">{sub}</p>}
        {children}
      </div>
      <div className="home-clock" aria-hidden="true">
        {clockFormat.format(now)}
        <small>{dayFormat.format(now)}</small>
      </div>
    </header>
  )
}

const arrow = (
  <svg className="place-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

// Every area the person may open, in the sidebar's sections.
const HOME_ONLY = ['/']

export function Workspace({ user, exclude = HOME_ONLY }) {
  const sections = useMemo(
    () => navSections(NAV_ITEMS.filter((item) => !exclude.includes(item.to) && hasAccess(user, item.access))),
    [user, exclude],
  )
  if (sections.length === 0) return null
  const total = sections.reduce((n, s) => n + s.items.length, 0)
  // One directory: the sections flow into balanced columns, so no row is left half empty.
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Go to</h2>
        <span>
          {total} {total === 1 ? 'place' : 'places'} you can open · press / to search them
        </span>
      </div>
      <nav className="panel directory" aria-label="Places you can open">
        {sections.map((section) => (
          <div key={section.id} className="directory-group">
            <h3>
              {section.label}
              <span>{section.items.length}</span>
            </h3>
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="directory-link" onMouseEnter={() => preloadPage(item.to)} onFocus={() => preloadPage(item.to)}>
                    <span className="place-icon">{item.icon}</span>
                    <span className="place-label">{item.label}</span>
                    {arrow}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </section>
  )
}

// A thin bar: how much of something is used. `value` and `max` are numbers; nothing shows without a max.
export function Meter({ value, max, label }) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null
  const share = Math.max(0, Math.min(1, value / max))
  const tone = share >= 1 ? ' over' : share >= 0.85 ? ' warn' : ''
  return (
    <div className={`meter${tone}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${share * 100}%` }} />
    </div>
  )
}
