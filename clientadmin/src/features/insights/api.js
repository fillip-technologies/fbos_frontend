import { api } from '@/shared/api/http.js'
import { DELIVERY, IDENTITY, MANAGEMENT, PEOPLE } from '@/shared/api/paths.js'
import { inOrg, listAll } from '@/shared/api/query.js'

const qs = (params = {}) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
const get = (orgId, path, { signal } = {}) => api.get(path, { headers: inOrg(orgId), signal })

// The numbers behind Insights and the insight panels on unit, person and project pages.
// Every service works them out over what the caller's own lists would show.
export const insightsApi = {
  // Same request as the other pages' unit lookups (key ['org-units', orgId, 'all']).
  units: (orgId, opts) => listAll(`${IDENTITY}/org-units`, orgId, {}, opts),
  // Filters: assignee, owning_unit_id, work_unit_id (any of the task list's).
  tasks: (orgId, params, opts) => get(orgId, `${DELIVERY}/tasks/stats?${qs({ weeks: 8, done_within_days: 30, ...params })}`, opts),
  projects: (orgId, opts) => get(orgId, `${DELIVERY}/work-units/stats`, opts),
  // { date_from, date_to } and optionally user_id, unit_id or work_unit_id.
  time: (orgId, params, opts) => get(orgId, `${DELIVERY}/time-entries/summary?${qs(params)}`, opts),
  budgets: (orgId, opts) => get(orgId, `${MANAGEMENT}/budgets/summary`, opts),
  workforce: (orgId, opts) => get(orgId, `${PEOPLE}/workers/summary?months=6`, opts),
  fiscalYears: (orgId, opts) => listAll(`${MANAGEMENT}/fiscal-years`, orgId, {}, opts),
  periods: (orgId, yearId, opts) => listAll(`${MANAGEMENT}/planning-periods`, orgId, { fiscal_year_id: yearId }, opts),
  kpiResults: (orgId, periodId, opts) => listAll(`${MANAGEMENT}/kpi-results`, orgId, { period_id: periodId }, opts),
}
