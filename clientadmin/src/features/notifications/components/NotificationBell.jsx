import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { notificationsApi } from '@/features/notifications/api.js'
import NotificationItem from '@/features/notifications/components/NotificationItem.jsx'
import { NOTIFICATIONS, refreshNotifications, useOpenNotification, useUnreadCount } from '@/features/notifications/hooks.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const RECENT = 8

const bellIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

function badgeText(count) {
  return count > 99 ? '99+' : String(count)
}

// The bell's unread count, for the mobile bar: a plain link to the notifications page.
export function NotificationLink() {
  const { data } = useUnreadCount()
  const count = data?.count ?? 0
  return (
    <Link to="/notifications" className="bell-btn" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
      {bellIcon}
      {count > 0 && <span className="bell-badge">{badgeText(count)}</span>}
    </Link>
  )
}

// The sidebar bell: the unread count, and a panel with the latest notifications.
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data } = useUnreadCount()
  const count = data?.count ?? 0
  const location = useLocation()
  const ref = useRef(null)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className={`bell-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        title="Notifications"
      >
        {bellIcon}
        {count > 0 && <span className={`bell-badge${data?.urgent ? ' urgent' : ''}`}>{badgeText(count)}</span>}
      </button>
      {open && <BellPanel unread={count} />}
    </div>
  )
}

function BellPanel({ unread }) {
  const { orgs } = useActiveOrg()
  const open = useOpenNotification()
  const [error, setError] = useState(null)
  const query = useQuery([NOTIFICATIONS, 'inbox', { limit: RECENT }], ({ signal }) => notificationsApi.list({ limit: RECENT }, { signal }))
  const items = query.data?.data ?? []
  const orgName = (id) => (orgs.length > 1 ? orgs.find((o) => o.id === id)?.name : undefined)

  async function markAllRead() {
    setError(null)
    try {
      await notificationsApi.markAllRead()
      refreshNotifications()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="bell-panel" role="dialog" aria-label="Notifications">
      <div className="bell-panel-head">
        <strong>Notifications</strong>
        {unread > 0 && (
          <button type="button" className="link-btn" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>
      <ErrorBanner error={error || query.error} onRetry={query.reload} />
      {query.loading ? (
        <div style={{ padding: 12 }}>
          <PanelSkeleton lines={3} />
        </div>
      ) : items.length === 0 && !query.error ? (
        <p className="muted small bell-empty">You're all caught up. Assignments and approvals will show up here.</p>
      ) : (
        <ul className="notice-list">
          {items.map((item) => (
            <NotificationItem key={item.id} item={item} onOpen={open} orgName={orgName(item.organization_id)} />
          ))}
        </ul>
      )}
      <Link to="/notifications" className="bell-panel-foot">
        See all notifications
      </Link>
    </div>
  )
}
