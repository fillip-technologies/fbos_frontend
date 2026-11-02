import { api } from '@/shared/api/http.js'
import { DELIVERY, IDENTITY, MANAGEMENT, PEOPLE, REVENUE } from '@/shared/api/paths.js'
import { inOrg } from '@/shared/api/query.js'

// ---------- The caller's own client: subscription window + quotas (read-only) ----------
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
