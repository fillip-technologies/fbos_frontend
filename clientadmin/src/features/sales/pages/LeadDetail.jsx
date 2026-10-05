import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi, opportunitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import ConvertLead from '@/features/sales/components/ConvertLead.jsx'
import useVerticals from '@/features/sales/useVerticals.js'
import { DISQUALIFY_REASONS, LEAD_SOURCES, SUBJECTS } from '@/features/sales/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { owners, ownerName } = useOwners(orgId)
  const { verticalName } = useVerticals(orgId)
  const canManage = hasAccess(me, ACCESS.manageLeads)
  const canConvert = canManage && (hasAccess(me, ACCESS.manageCustomers) || hasAccess(me, ACCESS.customers))

  const [lead, setLead] = useState(null)
  const [opportunity, setOpportunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // null | 'convert' | 'disqualify'
  const [panel, setPanel] = useState(null)
  const [disqualify, setDisqualify] = useState({ reason: 'no_need', note: '' })

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    leadsApi
      .get(orgId, id)
      .then(setLead)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

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

  if (loading) return <div className="center-note">Loading…</div>
  if (!lead)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
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

      <ErrorBanner error={error} />

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

        {canManage && open && !panel && (
          <div className="row-actions" style={{ marginTop: 16 }}>
            {lead.status === 'new' && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => run(() => leadsApi.update(orgId, lead.id, lead.version, { status: 'contacted' }))}
              >
                Mark contacted
              </button>
            )}
            {lead.status !== 'qualified' && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => run(() => leadsApi.update(orgId, lead.id, lead.version, { status: 'qualified' }))}
              >
                Mark qualified
              </button>
            )}
            {canConvert && <button className="btn" onClick={() => setPanel('convert')}>Convert…</button>}
            <button className="btn danger-outline" onClick={() => setPanel('disqualify')}>Disqualify…</button>
          </div>
        )}

        {panel === 'convert' && (
          <ConvertLead
            orgId={orgId}
            lead={lead}
            owners={owners}
            defaultCurrency={activeOrg?.base_currency || 'INR'}
            onConverted={(result) => navigate(`/opportunities/${result.opportunity.id}`)}
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

      {hasAccess(me, ACCESS.activities) && <ActivityTimeline orgId={orgId} subjectType={SUBJECTS.lead} subjectId={lead.id} />}
    </div>
  )
}
