import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi, opportunitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import ConvertLead from '@/features/sales/components/ConvertLead.jsx'
import useVerticals from '@/features/sales/useVerticals.js'
import { DISQUALIFY_REASONS, LEAD_SOURCES, SUBJECTS } from '@/features/sales/utils.js'

const OPEN_STATUSES = ['new', 'contacted', 'qualified']

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// What the person wrote on the company website; revenue imports it with the lead.
function WebsiteEnquiry({ details }) {
  return (
    <div className="panel">
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Website enquiry</h2>
      <div className="details-grid">
        <Detail label="Form">{details.website_form}</Detail>
        <Detail label="Package">{details.package}</Detail>
        <Detail label="Budget">{details.budget}</Detail>
        <Detail label="Location">{details.location}</Detail>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="detail-label">Message</div>
        <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>
          {details.message || <span className="muted">—</span>}
        </div>
      </div>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const {
    data: lead,
    error: loadError,
    loading,
    reload,
    setData,
  } = useQuery(['lead', orgId, id], ({ signal }) => leadsApi.get(orgId, id, { signal }), {
    enabled: Boolean(orgId),
  })
  // Saves a changed lead into the cache; its list is refetched on the next visit.
  const setLead = (next) => {
    setData(next)
    invalidate(['leads', orgId])
  }
  const { owners, ownerName } = useOwners(orgId)
  const { verticalName } = useVerticals(orgId)
  const canManage = hasAccess(me, ACCESS.manageLeads)
  const canConvert = canManage && (hasAccess(me, ACCESS.manageCustomers) || hasAccess(me, ACCESS.customers))

  const [opportunity, setOpportunity] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // null | 'convert' | 'disqualify'
  const [panel, setPanel] = useState(null)
  const [disqualify, setDisqualify] = useState({ reason: 'no_need', note: '' })

  // A converted lead's opportunity, found through its customer.
  useEffect(() => {
    if (!lead?.client_id || !hasAccess(me, ACCESS.opportunities)) return
    opportunitiesApi
      .list(orgId, { client_id: lead.client_id, limit: 100 })
      .then((res) => setOpportunity(res.data.find((o) => o.lead_id === lead.id) || null))
      .catch(() => setOpportunity(null))
  }, [orgId, lead, me])

  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      setLead(await action())
      setPanel(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (!lead)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/leads')}>← Back</button>
      </div>
    )

  const open = !['converted', 'disqualified'].includes(lead.status)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {lead.contact_name} <StatusBadge status={lead.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{lead.code}</span>
            {activeOrg && ` · ${activeOrg.name}`}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/leads')}>← Back</button>
      </div>

      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />

      {lead.status === 'converted' && (
        <div className="alert success">
          Converted.{' '}
          {lead.client_id && <Link to={`/customers/${lead.client_id}`}>Open the customer</Link>}
          {opportunity && (
            <>
              {' · '}
              <Link to={`/opportunities/${opportunity.id}`}>Open the opportunity “{opportunity.name}”</Link>
            </>
          )}
        </div>
      )}

      <div className="panel">
        <div className="details-grid">
          <Detail label="Company">{lead.company_name}</Detail>
          <Detail label="Email">{lead.contact_email && <a href={`mailto:${lead.contact_email}`}>{lead.contact_email}</a>}</Detail>
          <Detail label="Phone">{lead.contact_phone}</Detail>
          <Detail label="Vertical">{lead.vertical && (verticalName(lead.vertical.id) || 'Unknown vertical')}</Detail>
          <Detail label="Source">
            {LEAD_SOURCES[lead.source] || lead.source}
            {lead.campaign_ref && ` · ${lead.campaign_ref}`}
          </Detail>
          <Detail label="Score">{lead.score ?? null}</Detail>
          <Detail label="Added">{formatDate(lead.created_at.slice(0, 10))}</Detail>
          <Detail label="Owner">
            {canManage && open ? (
              <select
                aria-label="Owner"
                value={lead.owner?.id || ''}
                disabled={busy}
                onChange={(e) =>
                  e.target.value && run(() => leadsApi.update(orgId, lead.id, lead.version, { owner_user_id: e.target.value }))
                }
              >
                <option value="">— Unassigned —</option>
                {(owners || [me]).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            ) : (
              lead.owner && ownerName(lead.owner.id)
            )}
          </Detail>
        </div>

        {/* Any open status, either way; a disqualified lead can be reopened. Converted is final. */}
        {canManage && lead.status !== 'converted' && !panel && (
          <div className="row-actions" style={{ marginTop: 16 }}>
            {OPEN_STATUSES.filter((status) => status !== lead.status).map((status) => (
              <button
                key={status}
                className="btn secondary"
                disabled={busy}
                onClick={() => run(() => leadsApi.update(orgId, lead.id, lead.version, { status }))}
              >
                {open ? `Mark ${status}` : `Reopen as ${status}`}
              </button>
            ))}
            {open && canConvert && <button className="btn" onClick={() => setPanel('convert')}>Convert…</button>}
            {open && <button className="btn danger-outline" onClick={() => setPanel('disqualify')}>Disqualify…</button>}
          </div>
        )}

        {panel === 'convert' && (
          <ConvertLead
            orgId={orgId}
            lead={lead}
            owners={owners}
            defaultCurrency={activeOrg?.base_currency || 'INR'}
            onConverted={(result) => {
              invalidate(['leads', orgId])
              invalidate(['lead', orgId])
              invalidate(['opportunities', orgId])
              invalidate(['customers', orgId])
              navigate(`/opportunities/${result.opportunity.id}`)
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel === 'disqualify' && (
          <form
            className="inline-panel"
            onSubmit={(e) => {
              e.preventDefault()
              const body = { reason: disqualify.reason }
              if (disqualify.note.trim()) body.note = disqualify.note.trim()
              run(() => leadsApi.disqualify(orgId, lead.id, lead.version, body))
            }}
          >
            <h3>Disqualify lead</h3>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="dq-reason">Reason</label>
                <select
                  id="dq-reason"
                  value={disqualify.reason}
                  onChange={(e) => setDisqualify((d) => ({ ...d, reason: e.target.value }))}
                >
                  {Object.entries(DISQUALIFY_REASONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="dq-note">Note</label>
                <input id="dq-note" value={disqualify.note} onChange={(e) => setDisqualify((d) => ({ ...d, note: e.target.value }))} />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn danger" type="submit" disabled={busy}>Disqualify</button>
              <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {lead.attributes?.website_lead_id && <WebsiteEnquiry details={lead.attributes} />}

      {hasAccess(me, ACCESS.activities) && <ActivityTimeline orgId={orgId} subjectType={SUBJECTS.lead} subjectId={lead.id} />}
    </div>
  )
}
