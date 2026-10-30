import { useState } from 'react'
import { approveRoleChange, cancelRoleChange, rejectRoleChange } from '../api.js'
import { formatCurrency, formatDate, statusLabel } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const CHANGE_LABELS = { promotion: 'Promotion', demotion: 'Demotion', transfer: 'Transfer', correction: 'Correction' }

const Arrow = () => <span className="arrow">→</span>

// What a change does, one line per thing that changes.
function ChangeLines({ change, unitName }) {
  const lines = []
  if (change.new_designation) {
    lines.push(<li key="d">Designation: {change.previous_designation || '—'}<Arrow />{change.new_designation}</li>)
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
                    <td><ChangeLines change={c} unitName={unitName} /></td>
                    <td>{formatDate(c.effective_date)}</td>
                    <td className="small">
                      {c.reason}
                      {c.decision_note && <div className="muted">Decision: {c.decision_note}</div>}
                      {c.failure_reason && <div className="amount-neg">Could not apply: {c.failure_reason}</div>}
                    </td>
                    <td>
                      <StatusBadge status={c.status} label={statusLabel(c.status)} />
                      {c.status === 'approved' && <div className="muted small">applies {formatDate(c.effective_date)}</div>}
                      {c.status === 'pending' && mine && <div className="muted small">you requested it</div>}
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
      title={`Reject the ${CHANGE_LABELS[change.change_type].toLowerCase()} of ${change.worker_name}`}
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
