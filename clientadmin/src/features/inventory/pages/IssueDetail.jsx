import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { issuesApi, replacementsApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import {
  DISPOSITION_LABELS, ISSUE_STATUS_LABELS, PRIORITY_LABELS, VISIT_OUTCOME_LABELS, WARRANTY_STATUS_LABELS,
  formatDay as formatDate, priorityTone, warrantyTone,
} from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import ActionForm from '@/features/inventory/components/ActionForm.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

export default function IssueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [panel, setPanel] = useState(null)
  const { data: issue, error: loadError, loading, reload } = useQuery(['issue', orgId, id], ({ signal }) => issuesApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const technicians = useLookup(['inventory-technicians', orgId, issue?.site_id], ({ signal }) => issuesApi.technicians(orgId, issue.site_id, { signal }), {
    enabled: Boolean(orgId && issue && hasAccess(me, ACCESS.assignDeviceIssues)),
  })
  if (loading) return <DetailSkeleton />
  if (!issue) return <ErrorBanner error={loadError} onRetry={reload} />

  async function act(name, call) {
    setBusy(name)
    setError(null)
    try {
      await call()
      reload()
      invalidate(['issues', orgId])
      invalidate(['device', orgId, issue.device.id])
      setPanel(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const finished = ['resolved', 'closed'].includes(issue.status)
  const canWork = hasAccess(me, ACCESS.manageDeviceIssues)
  const openVisit = issue.visits.find((v) => v.status === 'in_progress')
  const activeReplacement = issue.replacements.find((r) => ['pending', 'approved'].includes(r.status))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{issue.issue_number}</span> <StatusBadge status={issue.status} label={ISSUE_STATUS_LABELS[issue.status]} />{' '}
            <StatusBadge status={priorityTone(issue.priority)} label={PRIORITY_LABELS[issue.priority]} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {issue.category.name} on <Link to={`/inventory/devices/${issue.device.id}`} className="mono">{issue.device.code}</Link>
            {issue.device.zone && ` · ${issue.device.zone.name}`} · raised {when(issue.created_at)}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/inventory/issues')}>← Back</button>
      </div>
      <ErrorBanner error={error} />

      <div className="panel">
        <p style={{ marginTop: 0 }}>{issue.description}</p>
        <div className="details-grid">
          <div><div className="detail-label">Device now</div><div className="detail-value"><LifecycleBadge state={issue.device.lifecycle_state} /></div></div>
          <div><div className="detail-label">Warranty</div><div className="detail-value"><StatusBadge status={warrantyTone(issue.warranty_status)} label={WARRANTY_STATUS_LABELS[issue.warranty_status]} />{issue.warranty_end_date && ` until ${formatDate(issue.warranty_end_date)}`}</div></div>
          <div><div className="detail-label">Technician</div><div className="detail-value">{issue.assigned_technician?.name ?? 'Unassigned'}</div></div>
          <div><div className="detail-label">Fix by</div><div className={`detail-value${issue.overdue ? ' error' : ''}`}>{when(issue.sla_due_at)}{issue.overdue && ' (overdue)'}</div></div>
          {issue.diagnosis_summary && <div><div className="detail-label">Found</div><div className="detail-value">{issue.diagnosis_summary}</div></div>}
          {issue.resolution_type && <div><div className="detail-label">Resolution</div><div className="detail-value">{issue.resolution_type.replace(/_/g, ' ')}</div></div>}
        </div>
      </div>

      {!finished && (
        <div className="row-actions" style={{ margin: '16px 0' }}>
          {hasAccess(me, ACCESS.assignDeviceIssues) && <button className="btn secondary" onClick={() => setPanel('assign')}>Assign technician</button>}
          {canWork && !openVisit && <button className="btn" disabled={!!busy} aria-busy={busy === 'checkin'} onClick={() => act('checkin', () => issuesApi.checkIn(orgId, issue.id))}>Check in on site</button>}
          {canWork && openVisit && <button className="btn" onClick={() => setPanel('checkout')}>Check out</button>}
          {hasAccess(me, ACCESS.requestReplacements) && !activeReplacement && issue.device.zone && <button className="btn secondary" onClick={() => setPanel('replace')}>Request replacement</button>}
          {canWork && !activeReplacement && <button className="btn secondary" disabled={!!busy} onClick={() => act('resolve', () => issuesApi.move(orgId, issue, { to_status: 'resolved', resolution_type: 'fixed_onsite' }))}>Mark resolved</button>}
        </div>
      )}
      {finished && issue.status === 'resolved' && canWork && (
        <div className="row-actions" style={{ margin: '16px 0' }}>
          <button className="btn secondary" disabled={!!busy} onClick={() => act('close', () => issuesApi.move(orgId, issue, { to_status: 'closed' }))}>Close</button>
          <button className="btn secondary" disabled={!!busy} onClick={() => act('reopen', () => issuesApi.move(orgId, issue, { to_status: 'reopened' }))}>Reopen</button>
        </div>
      )}

      {panel === 'assign' && (
        <ActionForm title="Assign technician" busy={busy} onCancel={() => setPanel(null)} fields={[{ name: 'technician_id', label: 'Technician', required: true, options: (technicians.data ?? []).map((t) => [t.id, t.name]) }]}
          onSubmit={(v) => act('assign', () => issuesApi.assign(orgId, issue, v.technician_id))} />
      )}
      {panel === 'checkout' && (
        <ActionForm title="Check out" busy={busy} onCancel={() => setPanel(null)}
          fields={[{ name: 'outcome', label: 'Outcome', required: true, options: Object.entries(VISIT_OUTCOME_LABELS) }, { name: 'findings', label: 'What you found', textarea: true }, { name: 'signatory_name', label: 'Signed off by (on site)' }]}
          onSubmit={(v) => act('checkout', () => issuesApi.checkOut(orgId, openVisit.id, v))} />
      )}
      {panel === 'replace' && (
        <ActionForm title="Request replacement" busy={busy} onCancel={() => setPanel(null)}
          fields={[
            { name: 'reason', label: 'Why', required: true, options: [['physical_damage', 'Physical damage'], ['burnt_water', 'Burnt / water damage'], ['unrepairable', 'Cannot be repaired on site'], ['obsolete', 'Obsolete']] },
            { name: 'old_device_disposition', label: 'The old unit then', required: true, options: Object.entries(DISPOSITION_LABELS) },
            { name: 'notes', label: 'Notes', textarea: true },
          ]}
          onSubmit={(v) => act('replace', () => replacementsApi.request(orgId, { issue_id: issue.id, ...v }))} />
      )}

      {issue.replacements.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Replacement</h2>
          {issue.replacements.map((r) => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <StatusBadge status={r.status} /> {r.faulty_device?.code} → {r.replacement_device ? <Link className="mono" to={`/inventory/devices/${r.replacement_device.id}`}>{r.replacement_device.code}</Link> : 'spare not picked yet'}
              <span className="muted small"> · {r.replacement_basis} · then {DISPOSITION_LABELS[r.old_device_disposition] ?? '—'}</span>
              {r.stock_transfer && <div className="small">Spare travels on <Link to={`/inventory/transfers/${r.stock_transfer.id}`}>{r.stock_transfer.transfer_number}</Link> ({r.stock_transfer.status})</div>}
              <div className="row-actions" style={{ marginTop: 8 }}>
                {r.status === 'pending' && hasAccess(me, ACCESS.approveReplacements) && (
                  <>
                    <button className="btn" disabled={!!busy} aria-busy={busy === 'approve'} onClick={() => act('approve', () => replacementsApi.approve(orgId, r.id))}>Approve and pick a spare</button>
                    <button className="btn secondary" disabled={!!busy} onClick={() => act('reject', () => replacementsApi.reject(orgId, r.id))}>Reject</button>
                  </>
                )}
                {r.status === 'approved' && hasAccess(me, ACCESS.manageDevices) && (
                  <button className="btn" disabled={!!busy} aria-busy={busy === 'complete'} onClick={() => act('complete', () => replacementsApi.complete(orgId, r.id))}>Swap done</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>History</h2>
        {issue.visits.map((v) => (
          <div key={v.id} className="small" style={{ marginBottom: 6 }}>
            Visit by {v.technician.name}: {when(v.check_in_at)} → {v.check_out_at ? when(v.check_out_at) : 'on site now'}
            {v.outcome && ` · ${VISIT_OUTCOME_LABELS[v.outcome]}`}{v.findings && ` · ${v.findings}`}
          </div>
        ))}
        {issue.history.map((h, n) => (
          <div key={n} className="small muted" style={{ marginBottom: 4 }}>
            {when(h.changed_at)} · {h.from_status ? `${ISSUE_STATUS_LABELS[h.from_status]} → ` : ''}{ISSUE_STATUS_LABELS[h.to_status]}{h.changed_by_name && ` · ${h.changed_by_name}`}{h.notes && ` · ${h.notes}`}
          </div>
        ))}
      </div>
    </div>
  )
}
