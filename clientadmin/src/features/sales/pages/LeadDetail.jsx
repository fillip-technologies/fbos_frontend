import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi, opportunitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import JourneyPath from '@/features/journey/components/JourneyPath.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import LeadCustomFields from '@/features/sales/components/LeadCustomFields.jsx'
import LeadHistory from '@/features/sales/components/LeadHistory.jsx'
import LogCall from '@/features/sales/components/LogCall.jsx'
import QualifyLead from '@/features/sales/components/QualifyLead.jsx'
import TransferLead from '@/features/sales/components/TransferLead.jsx'
import useLeadPeople from '@/features/sales/useLeadPeople.js'
import useVerticals from '@/features/sales/useVerticals.js'
import { DISQUALIFY_REASONS, LEAD_SOURCES, OPEN_LEAD_STATUSES, OUTREACH_LABEL, SUBJECTS } from '@/features/sales/utils.js'

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
  const { owners } = useOwners(orgId)
  const { people, personName } = useLeadPeople(orgId)
  const { verticalName } = useVerticals(orgId)

  const canWorkLeads = hasAccess(me, ACCESS.manageLeads)
  const canAssign = canWorkLeads && hasAccess(me, ACCESS.assignLeads)
  const canMakeCustomer = hasAccess(me, ACCESS.manageCustomers) || hasAccess(me, ACCESS.customers)

  const [opportunity, setOpportunity] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // null | 'call' | 'qualify' | 'transfer' | 'disqualify'
  const [panel, setPanel] = useState(null)
  const [disqualify, setDisqualify] = useState({ reason: 'no_need', note: '' })
  // Bumped after a call so the timeline shows it.
  const [timelineKey, setTimelineKey] = useState(0)

  // A qualified lead's opportunity, found through its customer.
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
      // Someone else claimed it, or it changed: show what it is now.
      if (['LEAD_ALREADY_CLAIMED', 'VERSION_CONFLICT'].includes(err?.code)) reload()
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

  const open = OPEN_LEAD_STATUSES.includes(lead.status)
  const owner = lead.owner?.id
  const mine = owner && owner === me?.id
  // The person handling it works it; a sales manager may work any lead.
  const canWork = canWorkLeads && Boolean(owner) && (mine || canAssign)
  const canQualify = canWork && canMakeCustomer && (lead.status === 'contacted' || (lead.status === 'qualified' && !lead.client_id))
  // Unclaimed junk (spam, duplicates) may be closed by anyone who works leads.
  const canClose = canWorkLeads && (!owner || canWork)
  const canReopen = lead.status === 'disqualified' && !lead.client_id && canClose

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
      <JourneyPath subject="lead" id={lead.id} version={lead.version} />

      {lead.client_id && lead.status !== 'disqualified' && (
        <div className="alert success">
          {lead.status === 'converted'
            ? `Converted${lead.converted_at ? ` on ${formatDate(lead.converted_at.slice(0, 10))}` : ''}: the customer accepted a quotation.`
            : 'Qualified. The work continues on the opportunity until the customer accepts a quotation.'}{' '}
          <Link to={`/customers/${lead.client_id}`}>Open the customer</Link>
          {opportunity && (
            <>
              {' · '}
              <Link to={`/opportunities/${opportunity.id}`}>Open the opportunity “{opportunity.name}”</Link>
            </>
          )}
        </div>
      )}
      {lead.status === 'qualified' && !lead.client_id && (
        <div className="alert warning">This lead was marked qualified before qualifying created a customer and an opportunity. Finish qualifying it below.</div>
      )}

      <div className="panel">
        <div className="details-grid">
          <Detail label={OUTREACH_LABEL}>
            {owner ? (
              personName(owner) || 'Someone'
            ) : (
              <span className="muted">Unclaimed</span>
            )}
          </Detail>
          <Detail label="Company">{lead.company_name}</Detail>
          <Detail label="Email">{lead.contact_email && <a href={`mailto:${lead.contact_email}`}>{lead.contact_email}</a>}</Detail>
          <Detail label="Phone">{lead.contact_phone}</Detail>
          <Detail label="Vertical">{lead.vertical && (verticalName(lead.vertical.id) || 'Unknown vertical')}</Detail>
          <Detail label="Source">
            {LEAD_SOURCES[lead.source] || lead.source}
            {lead.campaign_ref && ` · ${lead.campaign_ref}`}
          </Detail>
          <Detail label="Next follow-up">{open && lead.next_follow_up_on && formatDate(lead.next_follow_up_on)}</Detail>
          <Detail label="Score">{lead.score ?? null}</Detail>
          <Detail label="Added">{formatDate(lead.created_at.slice(0, 10))}</Detail>
          {lead.status === 'converted' && lead.converted_by_user_id && (
            <Detail label="Won by">{personName(lead.converted_by_user_id) || 'Someone'}</Detail>
          )}
        </div>

        {!panel && (open || canReopen) && (
          <div className="row-actions" style={{ marginTop: 16 }}>
            {open && !owner && canWorkLeads && (
              <button className="btn" disabled={busy} aria-busy={busy} onClick={() => run(() => leadsApi.claim(orgId, lead.id))}>
                Claim this lead
              </button>
            )}
            {open && canWork && <button className="btn" onClick={() => setPanel('call')}>Log a call</button>}
            {canQualify && <button className="btn secondary" onClick={() => setPanel('qualify')}>{lead.status === 'qualified' ? 'Finish qualifying…' : 'Qualify…'}</button>}
            {open && canWork && lead.status === 'new' && (
              <span className="muted small" style={{ alignSelf: 'center' }}>Log a call before qualifying.</span>
            )}
            {open && ((owner && canWork) || (!owner && canAssign)) && (
              <button className="btn secondary" onClick={() => setPanel('transfer')}>{owner ? 'Pass on…' : 'Assign…'}</button>
            )}
            {open && canClose && <button className="btn danger-outline" onClick={() => setPanel('disqualify')}>Disqualify…</button>}
            {canReopen && (
              <button className="btn secondary" disabled={busy} aria-busy={busy} onClick={() => run(() => leadsApi.reopen(orgId, lead.id, lead.version))}>
                Reopen
              </button>
            )}
          </div>
        )}
        {!panel && open && owner && !canWork && canWorkLeads && (
          <p className="muted small" style={{ margin: '16px 0 0' }}>
            {personName(owner) || 'Someone else'} handles this lead. Ask them, or a sales manager, to pass it to you.
          </p>
        )}

        {panel === 'call' && (
          <LogCall
            orgId={orgId}
            lead={lead}
            onLogged={(result) => {
              setLead(result.lead)
              setPanel(null)
              setTimelineKey((k) => k + 1)
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel === 'transfer' && (
          <TransferLead
            orgId={orgId}
            lead={lead}
            people={people}
            onTransferred={(next) => {
              setLead(next)
              setPanel(null)
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel === 'qualify' && (
          <QualifyLead
            orgId={orgId}
            lead={lead}
            owners={owners}
            defaultCurrency={activeOrg?.base_currency || 'INR'}
            onQualified={(result) => {
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
            {lead.client_id && (
              <p className="muted small" style={{ marginTop: 0 }}>Its opportunity is marked lost too, and the lead can’t be reopened afterwards.</p>
            )}
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

      <LeadCustomFields orgId={orgId} lead={lead} canEdit={canWorkLeads && (!owner || canWork)} onSaved={setLead} />
      {lead.attributes?.website_lead_id && <WebsiteEnquiry details={lead.attributes} />}

      {hasAccess(me, ACCESS.activities) && (
        <ActivityTimeline key={timelineKey} orgId={orgId} subjectType={SUBJECTS.lead} subjectId={lead.id} />
      )}
      <LeadHistory orgId={orgId} leadId={lead.id} version={lead.version} personName={personName} />
    </div>
  )
}
