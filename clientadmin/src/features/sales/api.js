import { api } from '@/shared/api/http.js'
import { IDENTITY, REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version) => inOrg(orgId, { 'If-Match': `"${version}"` })

// ---------- Leads ----------
export const leadsApi = {
  // Filters: status, source, vertical_id, owner_user_id.
  list: (orgId, opts) => api.get(`${REVENUE}/leads?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  get: (orgId, id) => api.get(`${REVENUE}/leads/${id}`, { headers: inOrg(orgId) }),
  create: (orgId, body) => api.post(`${REVENUE}/leads`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) => api.patch(`${REVENUE}/leads/${id}`, body, { headers: ifMatch(orgId, version) }),
  disqualify: (orgId, id, version, body) =>
    api.post(`${REVENUE}/leads/${id}/disqualify`, body, { headers: ifMatch(orgId, version) }),
  // { existing_client_id | new_client, opportunity } → { lead, client, opportunity, client_created }
  convert: (orgId, id, version, body) =>
    api.post(`${REVENUE}/leads/${id}/convert`, body, { headers: ifMatch(orgId, version) }),
}

// ---------- Opportunities ----------
export const opportunitiesApi = {
  // Filters: stage, client_id, owner_user_id.
  list: (orgId, opts) => api.get(`${REVENUE}/opportunities?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  get: (orgId, id) => api.get(`${REVENUE}/opportunities/${id}`, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) =>
    api.patch(`${REVENUE}/opportunities/${id}`, body, { headers: ifMatch(orgId, version) }),
  markLost: (orgId, id, version, body) =>
    api.post(`${REVENUE}/opportunities/${id}/lost`, body, { headers: ifMatch(orgId, version) }),
  // Every revision, newest first.
  quotations: (orgId, id) => api.get(`${REVENUE}/opportunities/${id}/quotations`, { headers: inOrg(orgId) }),
  createQuotation: (orgId, id, body) =>
    api.post(`${REVENUE}/opportunities/${id}/quotations`, body, { headers: inOrg(orgId) }),
}

// ---------- Quotations: draft → submit → (approve) → send → accept / reject ----------
const quotationAction = (action) => (orgId, quote, body) =>
  api.post(`${REVENUE}/quotations/${quote.id}/${action}`, body, { headers: ifMatch(orgId, quote.version) })

export const quotationsApi = {
  get: (orgId, id) => api.get(`${REVENUE}/quotations/${id}`, { headers: inOrg(orgId) }),
  replaceItems: (orgId, quote, items) =>
    api.put(`${REVENUE}/quotations/${quote.id}/items`, { items }, { headers: ifMatch(orgId, quote.version) }),
  submit: quotationAction('submit'),
  approve: quotationAction('approve'),
  send: quotationAction('send'),
  accept: quotationAction('accept'),
  reject: quotationAction('reject'),
  // A new draft revision; the current one becomes superseded.
  revise: (orgId, quote) => api.post(`${REVENUE}/quotations/${quote.id}/revise`, undefined, { headers: inOrg(orgId) }),
}

// ---------- Contracts ----------
export const contractsApi = {
  // Filters: client_id, opportunity_id, status.
  list: (orgId, opts) => api.get(`${REVENUE}/contracts?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  get: (orgId, id) => api.get(`${REVENUE}/contracts/${id}`, { headers: inOrg(orgId) }),
  create: (orgId, body) => api.post(`${REVENUE}/contracts`, body, { headers: inOrg(orgId) }),
  activate: (orgId, contract) =>
    api.post(`${REVENUE}/contracts/${contract.id}/activate`, undefined, { headers: ifMatch(orgId, contract.version) }),
}

// ---------- Offerings (what can be quoted) ----------
export const offeringsApi = {
  list: (orgId, opts) => api.get(`${REVENUE}/offerings?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  listAll: (orgId) => listAll(`${REVENUE}/offerings`, orgId),
  create: (orgId, body) => api.post(`${REVENUE}/offerings`, body, { headers: inOrg(orgId) }),
}

// ---------- Activities: calls, meetings and notes on a lead / opportunity / contract ----------
export const activitiesApi = {
  list: (orgId, subjectType, subjectId) =>
    api.get(`${REVENUE}/activities?${pageQuery({ limit: 100, subject_type: subjectType, subject_id: subjectId })}`, {
      headers: inOrg(orgId),
    }),
  create: (orgId, body) => api.post(`${REVENUE}/activities`, body, { headers: inOrg(orgId) }),
}

// The client's verticals (business lines); leads and offerings belong to one.
export const verticalOptions = (orgId) => listAll(`${IDENTITY}/verticals`, orgId, { status: 'active' })
