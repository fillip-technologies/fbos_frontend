import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '@/features/notifications/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'

// Every notification query lives under this prefix, so one invalidate refreshes the
// badge, the bell's list and the page together.
export const NOTIFICATIONS = 'notifications'
const POLL_MS = 60_000

// The unread count ({ count, urgent }). Every caller shares one cached request; the
// polling itself is done once, by useUnreadCountPolling in the layout.
export function useUnreadCount() {
  return useQuery([NOTIFICATIONS, 'unread-count'], ({ signal }) => notificationsApi.unreadCount({ signal }), {
    staleTime: POLL_MS,
  })
}

// Keeps the unread count current: checked every minute while the tab is visible and as
// soon as it becomes visible again; a hidden tab doesn't poll. Mount it once (Layout):
// each extra copy would add its own requests.
export function useUnreadCountPolling() {
  const { reload } = useUnreadCount()

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') reload()
    }
    const timer = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [reload])
}

export function refreshNotifications() {
  invalidate([NOTIFICATIONS])
}

// Opening a notification: mark it read, switch to the company it is about (a client
// admin's notifications span several), then go to the record.
export function useOpenNotification() {
  const navigate = useNavigate()
  const { orgs, orgId, selectOrg } = useActiveOrg()

  return useCallback(
    (item) => {
      if (!item.read_at) notificationsApi.markRead(item.id).then(refreshNotifications, () => {})
      if (!item.action_url) return
      const target = item.organization_id
      if (target && target !== orgId && orgs.some((o) => o.id === target)) selectOrg(target)
      navigate(item.action_url)
    },
    [navigate, orgs, orgId, selectOrg]
  )
}
