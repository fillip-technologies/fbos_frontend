import { Link } from 'react-router-dom'
import { quotationsApi } from '@/features/sales/api.js'
import useOwners from '@/features/customers/useOwners.js'
import { QUOTATION_EVENT_LABELS, WITHDRAWAL_REASONS, formatDateTime } from '@/features/sales/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'

// History moments are stored in UTC without a zone; read them as UTC.
const utc = (iso) => (/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)

function Details({ event }) {
  const { data = {} } = event
  switch (event.event) {
    case 'emailed':
      return (
        <>
          To {data.to?.join(', ')}
          {data.cc?.length > 0 && ` · Cc ${data.cc.join(', ')}`}
          {data.bcc?.length > 0 && ` · Bcc ${data.bcc.join(', ')}`}
          {data.subject && <> · “{data.subject}”</>}
          {data.files?.length > 0 && ` · ${data.files.join(', ')}`}
        </>
      )
    case 'withdrawn':
      return WITHDRAWAL_REASONS[data.reason] || data.reason || null
    case 'validity_extended':
      return `${data.from ? `${formatDate(data.from)} → ` : 'Now '}${formatDate(data.to)}`
    case 'submitted':
      return data.status === 'pending_approval' ? 'The discount needs approval.' : 'Within the discount limit.'
    case 'accepted':
      return data.expired ? 'After its validity ran out.' : null
    case 'revised':
      return data.revision_id ? <Link to={`/quotations/${data.revision_id}`}>Rev {data.revision_no}</Link> : null
    case 'created':
      if (data.copied_from)
        return (
          <>Copied from <Link to={`/quotations/${data.copied_from}`}>{data.quote_no} rev {data.revision_no}</Link></>
        )
      return data.revision_id ? (
        <>From <Link to={`/quotations/${data.revision_id}`}>rev {data.revision_no}</Link></>
      ) : null
    case 'not_chosen':
      return data.accepted_id ? (
        <>The customer accepted <Link to={`/quotations/${data.accepted_id}`}>{data.quote_no} rev {data.revision_no}</Link></>
      ) : null
    case 'renamed':
      return `${data.from || 'No name'} → ${data.to || 'no name'}`
    default:
      return null
  }
}

/** What happened to a quotation, oldest first (GET /quotations/{id}/events). */
export default function QuotationHistory({ orgId, quotationId }) {
  const { ownerName } = useOwners(orgId)
  const { data: events, error, loading, reload } = useQuery(
    ['quotation-events', orgId, quotationId],
    ({ signal }) => quotationsApi.events(orgId, quotationId, { signal }),
    { enabled: Boolean(orgId) }
  )

  return (
    <div className="panel">
      <h2 style={{ fontSize: 17 }}>History</h2>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <PanelSkeleton />
      ) : !events?.length ? (
        !error && <p className="muted small" style={{ margin: 0 }}>Nothing recorded yet.</p>
      ) : (
        <ol className="quotation-history">
          {events.map((e) => {
            const who = e.actor_user_id && ownerName(e.actor_user_id)
            return (
              <li key={e.id}>
                <div>
                  <strong>{QUOTATION_EVENT_LABELS[e.event] || e.event}</strong>
                  <span className="muted small">
                    {' · '}
                    {formatDateTime(utc(e.occurred_at))}
                    {who && ` · ${who}`}
                  </span>
                </div>
                <div className="muted small">
                  <Details event={e} />
                </div>
                {e.note && <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{e.note}</div>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
