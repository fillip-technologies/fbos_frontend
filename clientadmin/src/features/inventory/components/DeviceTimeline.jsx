import { useState } from 'react'
import { devicesApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { eventLabel } from '@/features/inventory/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

// The device's whole life, newest first, from the append-only lifecycle log.
export default function DeviceTimeline({ orgId, deviceId }) {
  const [cursor, setCursor] = useState(undefined)
  const [older, setOlder] = useState([])
  const { data, error, loading, refreshing, reload } = useQuery(
    ['device', orgId, deviceId, 'events', cursor],
    ({ signal }) => devicesApi.events(orgId, deviceId, { limit: 50, cursor }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  if (loading && older.length === 0) return <PanelSkeleton />
  const events = [...older, ...(data?.data ?? [])]
  const next = data?.page?.has_more ? data.page.next_cursor : null

  return (
    <div className={`panel${refreshing ? ' is-refreshing' : ''}`}>
      <ErrorBanner error={error} onRetry={reload} />
      {events.length === 0 ? (
        <p className="center-note">Nothing recorded yet.</p>
      ) : (
        <ol className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {events.map((e) => (
            <li key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
              <div className="muted small" style={{ minWidth: 150 }}>{when(e.occurred_at)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {eventLabel(e.event_type)}
                  {e.from_legacy_app && <span className="muted small"> · from the Fixly app</span>}
                </div>
                {e.to_state && (
                  <div className="small" style={{ marginTop: 4 }}>
                    {e.from_state && <><LifecycleBadge state={e.from_state} /> → </>}
                    <LifecycleBadge state={e.to_state} />
                  </div>
                )}
                {e.notes && <div className="muted small" style={{ marginTop: 4 }}>{e.notes}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {next && (
        <button
          className="btn secondary"
          style={{ marginTop: 12 }}
          disabled={refreshing}
          onClick={() => {
            setOlder(events)
            setCursor(next)
          }}
        >
          Older events
        </button>
      )}
    </div>
  )
}
