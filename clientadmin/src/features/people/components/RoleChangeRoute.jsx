import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDateTime, statusLabel } from '../utils.js'

// Who must approve a change, in order: the steps of a request, or of a preview before it is sent.
export function ApprovalRoute({ steps, nameOf }) {
  if (!steps?.length) return null
  return (
    <ol className="approval-route">
      {steps.map((step) => {
        const named = step.approver_user_ids.map((id) => nameOf(id)).join(', ')
        return (
          <li key={step.seq} className={step.status}>
            <div className="route-step-head">
              <strong>{step.name}</strong>
              <StatusBadge status={step.status} label={statusLabel(step.status)} />
            </div>
            <div className="muted small">
              {step.open_to_pool
                ? step.escalated_at
                  ? `Waited too long: now open to anyone who may approve role changes (${formatDateTime(step.escalated_at)})`
                  : 'Anyone who may approve role changes'
                : named}
              {step.decided_by && <> · {statusLabel(step.status)} by {nameOf(step.decided_by, 'an approver')}{step.acted_for && <> for {nameOf(step.acted_for, 'a colleague')}</>}</>}
            </div>
            {step.decision_note && <div className="small">“{step.decision_note}”</div>}
          </li>
        )
      })}
    </ol>
  )
}

const roleText = (role, unitName) => `${role.role_code}${role.scope_unit_id ? ` (${unitName(role.scope_unit_id)})` : ' (company-wide)'}`

// The access roles a change adds or removes, so approvers sign off on title, pay and access together.
export function AccessImpact({ impact, unitName }) {
  if (!impact) return null
  if (!impact.has_login) return <div className="muted small">This person has no login, so there is no access to change.</div>
  const { added, removed, notes } = impact
  if (!added.length && !removed.length && !notes.length) return <div className="muted small">No change to their access.</div>
  return (
    <div className="access-impact">
      {added.map((role) => <div key={`+${role.role_code}${role.scope_unit_id}`} className="impact-add">+ {roleText(role, unitName)}</div>)}
      {removed.map((role) => <div key={`-${role.role_code}${role.scope_unit_id}`} className="impact-remove">− {roleText(role, unitName)}</div>)}
      {notes.map((note) => <div key={note} className="muted small">{note}</div>)}
    </div>
  )
}
