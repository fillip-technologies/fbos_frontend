import { useState } from 'react'
import { notificationsApi } from '@/features/notifications/api.js'
import NotificationItem from '@/features/notifications/components/NotificationItem.jsx'
import { NOTIFICATIONS, refreshNotifications, useOpenNotification, useUnreadCount } from '@/features/notifications/hooks.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const TABS = [
  [false, 'All'],
  [true, 'Unread'],
]

// The signed-in user's notifications, newest first: things assigned to them, approvals
// of their quotations, deals they won. Personal, so not tied to the selected company.
export default function Notifications() {
  const { orgs } = useActiveOrg()
  const open = useOpenNotification()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(null)

  const { data: counts } = useUnreadCount()
  const { data, error, loading, refreshing, reload, setData } = useQuery(
    [NOTIFICATIONS, 'inbox', { unreadOnly, cursor }],
    ({ signal }) => notificationsApi.list({ limit: 25, unread: unreadOnly, cursor }, { signal }),
    { keepPrevious: true }
  )
  const items = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null
  const orgName = (id) => (orgs.length > 1 ? orgs.find((o) => o.id === id)?.name : undefined)

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  // Applies the change on screen at once, then refreshes the badge and other lists.
  async function act(key, call, patchItems) {
    setActionError(null)
    setBusy(key)
    try {
      await call()
      setData((d) => (d ? { ...d, data: patchItems(d.data) } : d))
      refreshNotifications()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(null)
    }
  }

  const now = () => new Date().toISOString()
  const setRead = (item, read) =>
    act(item.id, () => (read ? notificationsApi.markRead(item.id) : notificationsApi.markUnread(item.id)), (list) =>
      list.map((i) => (i.id === item.id ? { ...i, read_at: read ? now() : null } : i))
    )
  const archive = (item) =>
    act(item.id, () => notificationsApi.archive(item.id), (list) => list.filter((i) => i.id !== item.id))
  const markAllRead = () =>
    act('all', () => notificationsApi.markAllRead(), (list) => list.map((i) => (i.read_at ? i : { ...i, read_at: now() })))

  const unreadCount = counts?.count ?? 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Leads and customers assigned to you, approved quotations and won deals, newest first.
          </p>
        </div>
        <div className="row-actions">
          <button className="btn secondary" onClick={markAllRead} disabled={unreadCount === 0 || busy === 'all'} aria-busy={busy === 'all'}>
            Mark all read
          </button>
        </div>
      </div>

      <div className="version-tabs">
        {TABS.map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`version-tab${unreadOnly === value ? ' active' : ''}`}
            onClick={() => {
              resetPaging()
              setUnreadOnly(value)
            }}
          >
            {label}
            {value && unreadCount > 0 && <span className="bell-badge inline">{unreadCount}</span>}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <ErrorBanner error={actionError} />

      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            <PanelSkeleton lines={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h2>{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</h2>
            <p className="muted">
              {unreadOnly
                ? "You're all caught up."
                : "When someone assigns you a lead or customer, approves your quotation or a deal you own is won, you'll see it here."}
            </p>
          </div>
        ) : (
          <ul className="notice-list">
            {items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onOpen={open}
                orgName={orgName(item.organization_id)}
                actions={
                  <>
                    <button className="link-btn" disabled={busy === item.id} onClick={() => setRead(item, !item.read_at)}>
                      {item.read_at ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button className="link-btn" disabled={busy === item.id} onClick={() => archive(item)}>
                      Archive
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Newer
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Older →
        </button>
      </div>
    </div>
  )
}
