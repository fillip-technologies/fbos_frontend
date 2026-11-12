import { leadsApi } from '@/features/sales/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { LEAD_EVENT_LABELS, OUTREACH_LABEL, formatDateTime, humanize } from '@/features/sales/utils.js'

// Revenue keeps times in UTC without saying so: read them as UTC, not local time.
const asUtc = (iso) => (iso && !/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? `${iso}Z` : iso)

// Who added the lead, claimed it, passed it on (from whom, to whom, why), and each status
// change, oldest first. `version` refetches it after a change on the page.
export default function LeadHistory({ orgId, leadId, version, personName }) {
  const { data: events, error, loading, reload } = useQuery(
    ['lead-events', orgId, leadId, version],
    ({ signal }) => leadsApi.events(orgId, leadId, { signal }),
    { enabled: Boolean(orgId && leadId) }
  )
  const who = (id) => (id ? personName(id) || 'Someone' : null)

  function detail(e) {
    if (e.event === 'created') return e.to_user_id ? `${OUTREACH_LABEL}: ${who(e.to_user_id)}` : 'Unclaimed'
    if (e.event === 'claimed') return null
    if (e.event === 'transferred') return `${who(e.from_user_id) || 'Unclaimed'} → ${who(e.to_user_id)}`
    if (e.event === 'released') return `from ${who(e.from_user_id)}`
    if (e.from_status && e.to_status && e.event === 'reopened') return `as ${humanize(e.to_status)}`
    return null
  }

  return (
    <div className="panel">
      <h2 style={{ fontSize: 17, marginTop: 0 }}>History</h2>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <PanelSkeleton />
      ) : !events?.length ? (
        <p className="muted small" style={{ margin: 0 }}>Nothing recorded yet.</p>
      ) : (
        <table>
          <tbody>
            {[...events].reverse().map((e) => (
              <tr key={e.id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{LEAD_EVENT_LABELS[e.event] || humanize(e.event)}</div>
                  {detail(e) && <div className="small">{detail(e)}</div>}
                  {e.note && (
                    <div className="muted small" style={{ whiteSpace: 'pre-line' }}>
                      {e.event === 'qualified' ? 'Opportunity' : 'Reason'}: {e.note}
                    </div>
                  )}
                </td>
                <td className="muted small">{e.actor_user_id ? `by ${who(e.actor_user_id)}` : 'automatically'}</td>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(asUtc(e.occurred_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
