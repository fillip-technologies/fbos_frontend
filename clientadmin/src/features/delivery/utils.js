import { toIsoDate } from '@/shared/utils/dates.js'

// Labels for delivery's statuses and priorities. Badges take their colour from the status
// code itself (`.badge.<code>` in styles.css), so these maps only carry the words.

export const PROJECT_STATUS_LABELS = {
  draft: 'Draft',
  planned: 'Planned',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
}
// What a project can move to from each status (mirrors the backend's WORK_UNIT_TRANSITIONS).
export const PROJECT_NEXT_STATUSES = {
  draft: ['planned', 'active', 'cancelled'],
  planned: ['active', 'on_hold', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
}
export const PROJECT_PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
export const HEALTH_LABELS = { green: 'On track', amber: 'At risk', red: 'Off track', unknown: 'Unknown' }

export const TASK_STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  blocked: 'Blocked',
  submitted: 'Submitted',
  in_review: 'In review',
  rework: 'Needs rework',
  done: 'Done',
  cancelled: 'Cancelled',
}
export const OPEN_TASK_STATUSES = ['draft', 'open', 'assigned', 'in_progress', 'blocked', 'submitted', 'in_review', 'rework']
export const TASK_PRIORITY_LABELS = { p1: 'Urgent', p2: 'High', p3: 'Normal', p4: 'Low' }

export const MILESTONE_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
}
export const RISK_STATUS_LABELS = { open: 'Open', mitigating: 'Mitigating', closed: 'Closed', occurred: 'Occurred' }
export const CHANGE_REQUEST_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Waiting for a decision',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  withdrawn: 'Withdrawn',
}
export const HANDOVER_STATUS_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  rejected: 'Rejected',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

// What a task or handover is about, as identity's object-type registry names it.
export const SUBJECT_TYPES = { project: 'work.work_unit', task: 'task.task' }

// 90 -> "1h 30m", 45 -> "45m", 0/null -> "0m".
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes || 0))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

// "1h 30m", "1.5h", "90m" or "90" -> 90. Null when it isn't a duration.
export function parseDuration(text) {
  const value = String(text ?? '').trim().toLowerCase()
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)
  const match = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(value)
  if (!match || (match[1] === undefined && match[2] === undefined)) return null
  return Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0)
}

// ISO date-time -> local date, or "—".
export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function isOverdue(task) {
  return Boolean(task.due_at) && OPEN_TASK_STATUSES.includes(task.status) && new Date(task.due_at) < new Date()
}

// A due date picked as a day means "by the end of that day", local time.
export function dueAtFromDate(isoDate) {
  return isoDate ? new Date(`${isoDate}T23:59:00`).toISOString() : null
}

// ISO date-time -> the local day for a date input ("2026-10-06").
export function toDateInput(iso) {
  return iso ? toIsoDate(new Date(iso)) : ''
}

// ISO date-time -> "6 Oct", or "—".
export function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'
}
