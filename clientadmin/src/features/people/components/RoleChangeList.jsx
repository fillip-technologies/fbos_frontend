import { useState } from 'react'
import { approveRoleChange, cancelRoleChange, rejectRoleChange } from '../api.js'
import { CHANGE_LABELS, POST_TYPE_LABELS, formatCurrency, formatDate, formatShare, statusLabel } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'
import { AccessImpact, ApprovalRoute } from './RoleChangeRoute.jsx'
import useUserNames from '../useUserNames.js'

const Arrow = () => <span className="arrow">→</span>

// What a change does, one line per thing that changes.
function ChangeLines({ change, unitName }) {
  const lines = []
  if (change.change_type === 'add_post') {
    const share = change.new_time_share != null ? `, ${formatShare(change.new_time_share)} of their time` : ''
    const dept = change.new_unit_id ? `, ${unitName(change.new_unit_id)}` : ''
    const ends = change.end_date ? `, until ${formatDate(change.end_date)}` : ''
    lines.push(<li key="add">Adds the post “{change.new_designation}” ({POST_TYPE_LABELS[change.post_type] || change.post_type}{dept}{share}{ends})</li>)
  } else if (change.change_type === 'end_post') {
    lines.push(<li key="end">Ends the post “{change.post_title || change.previous_designation}”</li>)
  } else if (change.change_type === 'make_primary') {
    lines.push(<li key="primary">Makes “{change.post_title}” the primary post{change.previous_designation ? `, replacing “${change.previous_designation}”` : ''}</li>)
  } else if (change.post_title && change.post_type && change.post_type !== 'primary') {
    lines.push(<li key="post" className="muted">Post: {change.post_title} ({POST_TYPE_LABELS[change.post_type] || change.post_type})</li>)
  }
  if (change.change_type === 'add_post' || change.change_type === 'end_post' || change.change_type === 'make_primary') {
    if (change.has_allowance_change) {
      lines.push(<li key="allow">Allowance: {change.new_monthly_allowance != null ? `${formatCurrency(change.new_monthly_allowance, 'INR')} a month` : 'set (hidden from you)'}</li>)
    }
    return <ul className="change-lines">{lines}</ul>
  }
  if (change.new_time_share != null) lines.push(<li key="share">Share of time: {formatShare(change.new_time_share)}</li>)
  if (change.has_allowance_change) {
    lines.push(<li key="allow">Allowance: {change.new_monthly_allowance != null ? `${formatCurrency(change.new_monthly_allowance, 'INR')} a month` : 'changes (hidden from you)'}</li>)
  }
  if (change.new_designation) {
    lines.push(<li key="d">Designation: {change.previous_designation || '—'}<Arrow />{change.new_designation}</li>)
  }
  if (change.new_role_codes) {
    const names = (roles) => (roles?.length ? roles.map((r) => r.name || r.role_code).join(', ') : 'none')
    lines.push(<li key="r">Role: {names(change.previous_role_codes)}<Arrow />{names(change.new_role_codes)}</li>)
  }
  if (change.new_unit_id) {
    lines.push(
      <li key="u">
        Department: {change.previous_unit_id ? unitName(change.previous_unit_id) : '—'}<Arrow />{unitName(change.new_unit_id)}
      </li>,
    )
  }
  if (change.new_manager_id) {
    lines.push(<li key="m">Manager: {change.previous_manager_name || '—'}<Arrow />{change.new_manager_name}</li>)
  }
  if (change.new_position_id) {
    lines.push(<li key="p">Seat: {change.previous_position_label || '—'}<Arrow />{change.new_position_label}</li>)
  }
  if (change.has_salary_change) {
    lines.push(
      <li key="s">
        Salary:{' '}
        {change.new_annual_ctc != null
          ? `${change.previous_annual_ctc != null ? `${formatCurrency(change.previous_annual_ctc, 'INR')} → ` : ''}${formatCurrency(change.new_annual_ctc, 'INR')} a year`
          : 'changes (hidden from you)'}
      </li>,
    )
  }
  return <ul className="change-lines">{lines}</ul>
}

// Role changes with their status and, for those who may, Approve / Reject / Cancel.
export default function RoleChangeList({ changes, loading, me, canApprove, canRequest, showWorker = false, unitName = () => '—', onChanged }) {
  const { orgId } = useActiveOrg()
  const { nameOf } = useUserNames(orgId)
  const [actionError, setActionError] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const act = async (action) => {
    try {
      setActionError(null)
      await action()
      onChanged()
    } catch (err) {
      setActionError(err)
    }
  }

  const colSpan = showWorker ? 7 : 6
  return (
    <div>
      <ErrorBanner error={actionError} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              {showWorker && <th>Employee</th>}
              <th>Type</th>
              <th>Change</th>
              <th>Effective</th>
              <th>Reason</th>
              <th>Status</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="center-note">Loading role changes...</td></tr>
            ) : changes.length === 0 ? (
              <tr><td colSpan={colSpan} className="center-note">No role changes.</td></tr>
            ) : (
              changes.map((c) => {
                const mine = c.requested_by === me?.id
                const open = c.status === 'pending' || c.status === 'approved'
                return (
                  <tr key={c.id}>
                    {showWorker && <td><strong>{c.worker_name}</strong></td>}
                    <td><StatusBadge status={c.change_type} label={CHANGE_LABELS[c.change_type]} /></td>
                    <td>
                      <ChangeLines change={c} unitName={unitName} />
                      {c.status === 'pending' && c.access_impact && (
                        <div style={{ marginTop: 6 }}>
                          <div className="muted small">Access</div>
                          <AccessImpact impact={c.access_impact} unitName={unitName} />
                        </div>
                      )}
                    </td>
                    <td>{formatDate(c.effective_date)}</td>
                    <td className="small">
                      {c.reason}
                      {c.decision_note && <div className="muted">Decision: {c.decision_note}</div>}
                      {c.failure_reason && <div className="amount-neg">Could not apply: {c.failure_reason}</div>}
                    </td>
                    <td>
                      <StatusBadge status={c.status} label={statusLabel(c.status)} />
                      {c.status === 'approved' && <div className="muted small">applies {formatDate(c.effective_date)}</div>}
                      {c.status === 'pending' && c.awaiting_step && <div className="muted small">waiting for: {c.awaiting_step}</div>}
                      {c.status === 'pending' && mine && <div className="muted small">you requested it</div>}
                      {c.steps?.length > 1 && (
                        <details className="small">
                          <summary>Approvals ({c.steps.filter((step) => step.status === 'approved').length} of {c.steps.length})</summary>
                          <ApprovalRoute steps={c.steps} nameOf={nameOf} />
                        </details>
                      )}
                    </td>
                    <td className="right">
                      <div className="table-actions">
                        {c.status === 'pending' && canApprove && !mine && (
                          <>
                            <button type="button" className="btn small-btn" onClick={() => act(() => approveRoleChange(c.id))}>
                              Approve
                            </button>
                            <button type="button" className="btn danger-outline small-btn" onClick={() => setRejecting(c)}>
                              Reject
                            </button>
                          </>
                        )}
                        {open && (mine || canApprove) && (canRequest || canApprove) && (
                          <button
                            type="button"
                            className="btn secondary small-btn"
                            onClick={() => window.confirm('Cancel this role change?') && act(() => cancelRoleChange(c.id))}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {rejecting && (
        <RejectDialog
          change={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function RejectDialog({ change, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await rejectRoleChange(change.id, note.trim())
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      title={`Reject the ${(CHANGE_LABELS[change.change_type] || 'role change').toLowerCase()} of ${change.worker_name}`}
      intro="The person who requested it is told, with your reason."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Reject"
      saving={saving}
      error={error}
    >
      <Field label="Reason" required error={fieldErrors.note}>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Field>
    </FormDialog>
  )
}
