import { api } from '@/shared/api/http.js'
import { MANAGEMENT } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const qs = (params = {}) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()

const get = (orgId, path, { signal } = {}) => api.get(`${MANAGEMENT}${path}`, { headers: inOrg(orgId), signal })
const post = (orgId, path, body) => api.post(`${MANAGEMENT}${path}`, body, { headers: inOrg(orgId) })

export const planningApi = {
  fiscalYears: (orgId, { signal } = {}) => listAll(`${MANAGEMENT}/fiscal-years`, orgId, {}, { signal }),
  createFiscalYear: (orgId, body) => post(orgId, '/fiscal-years', body),
  periods: (orgId, fiscalYearId, { signal } = {}) =>
    listAll(`${MANAGEMENT}/planning-periods`, orgId, { fiscal_year_id: fiscalYearId }, { signal }),
  goals: (orgId, opts, { signal } = {}) => get(orgId, `/goals?${pageQuery(opts)}`, { signal }),
  createGoal: (orgId, body) => post(orgId, '/goals', body),
  checkIns: (orgId, goalId, { signal } = {}) => get(orgId, `/goals/${goalId}/check-ins`, { signal }),
  checkIn: (orgId, goalId, body) => post(orgId, `/goals/${goalId}/check-ins`, body),
}

export const scorecardApi = {
  scorecard: (orgId, periodId, { signal } = {}) => get(orgId, `/scorecard?${qs({ period_id: periodId })}`, { signal }),
}

export const budgetsApi = {
  list: (orgId, opts, { signal } = {}) => get(orgId, `/budgets?${pageQuery(opts)}`, { signal }),
  get: (orgId, id, { signal } = {}) => get(orgId, `/budgets/${id}`, { signal }),
  create: (orgId, body) => post(orgId, '/budgets', body),
  addLine: (orgId, id, body) => post(orgId, `/budgets/${id}/lines`, body),
  submit: (orgId, id) => post(orgId, `/budgets/${id}/submit`),
  revise: (orgId, id) => post(orgId, `/budgets/${id}/revisions`),
  variance: (orgId, id, { signal } = {}) => get(orgId, `/budgets/${id}/variance`, { signal }),
}

export const capacityApi = {
  utilization: (orgId, params, { signal } = {}) => get(orgId, `/utilization?${qs(params)}`, { signal }),
  bench: (orgId, params, { signal } = {}) => get(orgId, `/bench?${qs(params)}`, { signal }),
  resources: (orgId, opts, { signal } = {}) => get(orgId, `/resources?${pageQuery(opts)}`, { signal }),
}
