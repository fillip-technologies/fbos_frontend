import { timeAgo } from '@/shared/utils/dates.js'

// One notification: title, detail and age, with a dot while unread. Clicking it opens the
// record it is about (`onOpen`); `actions` are extra buttons on the right (page only).
export default function NotificationItem({ item, onOpen, orgName, actions }) {
  const unread = !item.read_at
  const urgent = item.urgency === 'urgent' || item.urgency === 'high'
  return (
    <li className={`notice${unread ? ' unread' : ''}`}>
      <span className={`notice-dot${urgent ? ' urgent' : ''}`} aria-label={unread ? 'Unread' : undefined} />
      <button type="button" className="notice-main" onClick={() => onOpen(item)} disabled={!item.action_url && !unread}>
        <span className="notice-title">{item.title}</span>
        {item.body && <span className="notice-body">{item.body}</span>}
        <span className="notice-meta" title={new Date(item.created_at).toLocaleString()}>
          {timeAgo(item.created_at)}
          {orgName && ` · ${orgName}`}
        </span>
      </button>
      {actions && <div className="notice-actions">{actions}</div>}
    </li>
  )
}
