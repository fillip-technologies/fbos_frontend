import { api } from '@/shared/api/http.js'
import { DELIVERY, IDENTITY, MANAGEMENT, PEOPLE, REVENUE } from '@/shared/api/paths.js'
import { inOrg } from '@/shared/api/query.js'

// ---------- The caller's own client: subscription window + quotas (read-only) ----------
// subscription_end / max_organizations / max_users_per_org are null when unlimited.
export const clientApi = {
  me: ({ signal } = {}) => api.get(`${IDENTITY}/clients/me`, { signal }),
}

const get = (orgId, path, { signal } = {}) => api.get(path, { headers: inOrg(orgId), signal })

// ---------- The overview: one summary per service, each behind its list's read permission ----------
// Counts and money are worked out by each service over what the caller's lists would show.
export const overviewApi = {
  leads: (orgId, months, opts) => get(orgId, `${REVENUE}/leads/summary?months=${months}`, opts),
  opportunities: (orgId, opts) => get(orgId, `${REVENUE}/opportunities/summary`, opts),
  contracts: (orgId, opts) => get(orgId, `${REVENUE}/contracts/summary`, opts),
  invoices: (orgId, months, opts) => get(orgId, `${REVENUE}/invoices/summary?months=${months}`, opts),
  payments: (orgId, months, opts) => get(orgId, `${REVENUE}/payments/summary?months=${months}`, opts),
  tasks: (orgId, weeks, opts) => get(orgId, `${DELIVERY}/tasks/stats?weeks=${weeks}&done_within_days=30`, opts),
  projects: (orgId, opts) => get(orgId, `${DELIVERY}/work-units/stats`, opts),
  workforce: (orgId, months, opts) => get(orgId, `${PEOPLE}/workers/summary?months=${months}`, opts),
  // Capacity is minutes on the API; this month, first day to last.
  utilization: (orgId, from, to, opts) => get(orgId, `${MANAGEMENT}/utilization?from=${from}&to=${to}`, opts),
}

// ---------- "Needs you": what is waiting on the signed-in person, each behind its own permission ----------
export const attentionApi = {
  // { assigned_open, due_today, overdue }: the caller's own open tasks.
  myTasks: (orgId, opts) => get(orgId, `${DELIVERY}/tasks/summary`, opts),
  // Quotations waiting for approval, newest first.
  quotationsToApprove: (orgId, opts) => get(orgId, `${REVENUE}/quotations?status=pending_approval&limit=5`, opts),
  // Contract payment terms due to be invoiced now (a plain list).
  readyToBill: (orgId, opts) => get(orgId, `${REVENUE}/billing-schedule-lines?billable=true`, opts),
  // Role changes still waiting for an approval step.
  roleChanges: (orgId, opts) => get(orgId, `${PEOPLE}/role-changes?status=pending`, opts),
  // Leave requests not yet decided: the caller's own and those of the people they approve for.
  pendingLeave: (orgId, opts) => get(orgId, `${PEOPLE}/leaves/requests?status=pending`, opts),
  // Open leads nobody has claimed yet (a page of up to 25).
  unclaimedLeads: (orgId, opts) => get(orgId, `${REVENUE}/leads?unclaimed=true&limit=25`, opts),
  // The caller's open leads with a follow-up due on or before `today`.
  leadFollowUps: (orgId, userId, today, opts) =>
    get(orgId, `${REVENUE}/leads?owner_user_id=${encodeURIComponent(userId)}&follow_up_due=${today}&limit=25`, opts),
}
