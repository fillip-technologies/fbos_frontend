import { api, uuidv4 } from '@/shared/api/http.js'
import { REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version, extra = {}) => inOrg(orgId, { 'If-Match': `"${version}"`, ...extra })
// Money-moving and document-issuing calls need an Idempotency-Key. Callers pass one key per
// user action so a retried request (e.g. after a token refresh) can't happen twice.
const once = (key) => ({ 'Idempotency-Key': key || uuidv4() })

// ---------- Invoices and credit notes ----------
export const invoicesApi = {
  // Filters: status, client_id, contract_id, issue_from, issue_to.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/invoices?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  listAll: (orgId, params, req) => listAll(`${REVENUE}/invoices`, orgId, params, req),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/invoices/${id}`, { headers: inOrg(orgId), signal }),
  createDraft: (orgId, body) => api.post(`${REVENUE}/invoices`, body, { headers: inOrg(orgId) }),
  // Assigns the next invoice number. body: { issue_date? }
  issue: (orgId, invoice, body, key) =>
    api.post(`${REVENUE}/invoices/${invoice.id}/issue`, body, { headers: ifMatch(orgId, invoice.version, once(key)) }),
  // body: { reason, note?, lines? } — without lines the whole invoice is reversed.
  creditNote: (orgId, invoice, body, key) =>
    api.post(`${REVENUE}/invoices/${invoice.id}/credit-notes`, body, { headers: inOrg(orgId, once(key)) }),
}

// ---------- Payments received ----------
export const paymentsApi = {
  // Filters: client_id, received_from, received_to, unallocated.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/payments?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/payments/${id}`, { headers: inOrg(orgId), signal }),
  record: (orgId, body, key) => api.post(`${REVENUE}/payments`, body, { headers: inOrg(orgId, once(key)) }),
  allocate: (orgId, payment, allocations, key) =>
    api.post(`${REVENUE}/payments/${payment.id}/allocations`, { allocations }, {
      headers: ifMatch(orgId, payment.version, once(key)),
    }),
}

// ---------- Collections: one case per customer owing overdue money ----------
export const collectionsApi = {
  // Filters: status, client_id, owner_user_id.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/collection-cases?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  followUps: (orgId, caseId, { signal } = {}) =>
    api.get(`${REVENUE}/collection-cases/${caseId}/follow-ups`, { headers: inOrg(orgId), signal }),
  logFollowUp: (orgId, caseId, body) =>
    api.post(`${REVENUE}/collection-cases/${caseId}/follow-ups`, body, { headers: inOrg(orgId) }),
  // Marks invoices past due as overdue and opens / resolves cases. Safe to repeat.
  refresh: (orgId) => api.post(`${REVENUE}/collection-cases/refresh`, undefined, { headers: inOrg(orgId) }),
}

// A customer's contracts, to link an invoice to one.
export const contractOptions = (orgId, customerId) => listAll(`${REVENUE}/contracts`, orgId, { client_id: customerId })
