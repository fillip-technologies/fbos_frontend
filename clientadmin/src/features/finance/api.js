import { api } from '@/shared/api/http.js'
import { FINANCE } from '@/shared/api/paths.js'
import { inOrg, pageQuery } from '@/shared/api/query.js'

// The Finance service: operating expenses (rent, travel, marketing…), investments and income
// outside sales. Money travels as decimal strings ("1250.00").

export const expensesApi = {
  // Filters: from, to, category_id, approval_status, payment_status, work_unit_id, org_unit_id, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${FINANCE}/expenses?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${FINANCE}/expenses/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${FINANCE}/expenses`, body, { headers: inOrg(orgId) }),
  // Only the fields sent change. Changing amount, tax, category or date sends it for approval again.
  update: (orgId, id, body) => api.patch(`${FINANCE}/expenses/${id}`, body, { headers: inOrg(orgId) }),
  remove: (orgId, id) => api.del(`${FINANCE}/expenses/${id}`, { headers: inOrg(orgId) }),
  // { decision: 'approve' | 'reject', comment } (a rejection needs a comment).
  decide: (orgId, id, body) => api.post(`${FINANCE}/expenses/${id}/decisions`, body, { headers: inOrg(orgId) }),
}

export const expenseCategoriesApi = {
  list: (orgId, { includeInactive = false } = {}, { signal } = {}) =>
    api.get(`${FINANCE}/expense-categories${includeInactive ? '?include_inactive=true' : ''}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${FINANCE}/expense-categories`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, body) => api.patch(`${FINANCE}/expense-categories/${id}`, body, { headers: inOrg(orgId) }),
}

export const financeSettingsApi = {
  get: (orgId, { signal } = {}) => api.get(`${FINANCE}/settings`, { headers: inOrg(orgId), signal }),
  // { expense_approval_threshold: "25000" | null, default_currency }
  update: (orgId, body) => api.patch(`${FINANCE}/settings`, body, { headers: inOrg(orgId) }),
}

export const investmentsApi = {
  // Filters: status, investment_type, investee_organization_id.
  list: (orgId, opts, { signal } = {}) => api.get(`${FINANCE}/investments?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${FINANCE}/investments/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${FINANCE}/investments`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, body) => api.patch(`${FINANCE}/investments/${id}`, body, { headers: inOrg(orgId) }),
  remove: (orgId, id) => api.del(`${FINANCE}/investments/${id}`, { headers: inOrg(orgId) }),
}

export const incomeApi = {
  // Filters: from, to, income_type, investment_id.
  list: (orgId, opts, { signal } = {}) => api.get(`${FINANCE}/income-entries?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${FINANCE}/income-entries`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, body) => api.patch(`${FINANCE}/income-entries/${id}`, body, { headers: inOrg(orgId) }),
  remove: (orgId, id) => api.del(`${FINANCE}/income-entries/${id}`, { headers: inOrg(orgId) }),
}
