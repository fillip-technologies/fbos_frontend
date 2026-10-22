import { describeDevice } from '@/features/sessions/utils.js'
import { timeAgo } from '@/shared/utils/dates.js'
import { formatDateTime } from '@/features/users/utils.js'

// Sessions as a table. With `onSignOut`, every session but the current one gets a button.
export default function SessionList({ sessions, onSignOut, busyId, emptyText }) {
  if (sessions.length === 0) return <p className="muted">{emptyText}</p>
  return (
    <table className="compact">
      <thead>
        <tr>
          <th>Device</th>
          <th>IP address</th>
          <th>Signed in</th>
          <th>Last active</th>
          {onSignOut && <th />}
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id}>
            <td title={s.user_agent || undefined}>
              {describeDevice(s.user_agent)} {s.current && <span className="chip subtle">This browser</span>}
            </td>
            <td className="mono">{s.ip_address || <span className="muted">—</span>}</td>
            <td>{formatDateTime(s.signed_in_at)}</td>
            <td title={formatDateTime(s.last_active_at)}>{timeAgo(s.last_active_at)}</td>
            {onSignOut && (
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {!s.current && (
                  <button className="link-btn danger" disabled={busyId === s.id} onClick={() => onSignOut(s)}>
                    {busyId === s.id ? 'Signing out…' : 'Sign out'}
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
