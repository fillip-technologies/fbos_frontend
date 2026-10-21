import { api } from '@/shared/api/http.js'
import { IDENTITY, REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version) => inOrg(orgId, { 'If-Match': `"${version}"` })

// ---------- Leads ----------
export const leadsApi = {
  // Filters: status, source, vertical_id, owner_user_id.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/leads?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/leads/${id}`, { headers: inOrg(orgId), signal }),
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
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/opportunities?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/opportunities/${id}`, { headers: inOrg(orgId), signal }),
  // Repeat business: { client_id, name, expected_value, expected_close_date, owner_user_id? }, no lead.
  create: (orgId, body) => api.post(`${REVENUE}/opportunities`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) =>
    api.patch(`${REVENUE}/opportunities/${id}`, body, { headers: ifMatch(orgId, version) }),
  markLost: (orgId, id, version, body) =>
    api.post(`${REVENUE}/opportunities/${id}/lost`, body, { headers: ifMatch(orgId, version) }),
  // Every revision, newest first.
  quotations: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/opportunities/${id}/quotations`, { headers: inOrg(orgId), signal }),
  // A new option; { copy_from, name, valid_until? } copies another quotation of the opportunity (files too).
  createQuotation: (orgId, id, body) =>
    api.post(`${REVENUE}/opportunities/${id}/quotations`, body, { headers: inOrg(orgId) }),
}

// ---------- Quotations: draft → submit → (approve) → send → accept / changes requested / reject; withdraw ----------
const quotationAction = (action) => (orgId, quote, body) =>
  api.post(`${REVENUE}/quotations/${quote.id}/${action}`, body, { headers: ifMatch(orgId, quote.version) })

export const quotationsApi = {
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/quotations/${id}`, { headers: inOrg(orgId), signal }),
  // { name } renames the option; { is_main: true } makes it the opportunity's main quotation.
  update: (orgId, quote, body) =>
    api.patch(`${REVENUE}/quotations/${quote.id}`, body, { headers: ifMatch(orgId, quote.version) }),
  replaceItems: (orgId, quote, items) =>
    api.put(`${REVENUE}/quotations/${quote.id}/items`, { items }, { headers: ifMatch(orgId, quote.version) }),
  submit: quotationAction('submit'),
  approve: quotationAction('approve'),
  send: quotationAction('send'),
  accept: quotationAction('accept'),
  reject: quotationAction('reject'),
  // { note }: what the customer asked to change.
  requestChanges: quotationAction('change-requests'),
  // { reason, note? }: reason is one of WITHDRAWAL_REASONS.
  withdraw: quotationAction('withdrawal'),
  setValidity: (orgId, quote, validUntil) =>
    api.patch(`${REVENUE}/quotations/${quote.id}/validity`, { valid_until: validUntil }, { headers: ifMatch(orgId, quote.version) }),
  // Its history, oldest first: [{ event, occurred_at, actor_user_id, note, data }].
  events: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/quotations/${id}/events`, { headers: inOrg(orgId), signal }),
  // A new draft revision; the current one becomes superseded.
  revise: (orgId, quote) => api.post(`${REVENUE}/quotations/${quote.id}/revise`, undefined, { headers: inOrg(orgId) }),
  // { sender, contacts, to, subject, message, marks_sent, emailable }: what the email form starts from.
  emailDraft: (orgId, id, { signal } = {}) =>
    api.get(`${REVENUE}/quotations/${id}/email-draft`, { headers: inOrg(orgId), signal }),
  // { to, cc, bcc, subject, message, document_ids } → { from_address, to, cc, bcc, attachments, quotation }.
  // A draft or approved quotation is marked sent too, hence If-Match.
  email: (orgId, quote, body) =>
    api.post(`${REVENUE}/quotations/${quote.id}/emails`, body, { headers: ifMatch(orgId, quote.version) }),
}

// ---------- Contracts ----------
export const contractsApi = {
  // Filters: client_id, opportunity_id, status.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/contracts?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/contracts/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${REVENUE}/contracts`, body, { headers: inOrg(orgId) }),
  // The signed copy is uploaded to the contract through the documents service first.
  setSignedDocument: (orgId, contract, documentId) =>
    api.put(`${REVENUE}/contracts/${contract.id}/signed-document`, { document_id: documentId }, { headers: ifMatch(orgId, contract.version) }),
  activate: (orgId, contract) =>
    api.post(`${REVENUE}/contracts/${contract.id}/activate`, undefined, { headers: ifMatch(orgId, contract.version) }),
  // { sender, contacts, to, subject, message, emailable }: what the email form starts from.
  emailDraft: (orgId, id, { signal } = {}) =>
    api.get(`${REVENUE}/contracts/${id}/email-draft`, { headers: inOrg(orgId), signal }),
  // { to, cc, bcc, subject, message, document_ids } → { from_address, to, cc, bcc, attachments, contract }; its status stays.
  email: (orgId, id, body) => api.post(`${REVENUE}/contracts/${id}/emails`, body, { headers: inOrg(orgId) }),
}

// ---------- Offerings (what can be quoted) ----------
export const offeringsApi = {
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/offerings?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  listAll: (orgId, { signal } = {}) => listAll(`${REVENUE}/offerings`, orgId, {}, { signal }),
  create: (orgId, body) => api.post(`${REVENUE}/offerings`, body, { headers: inOrg(orgId) }),
  // { fulfilment }: what a won contract for it is delivered as.
  update: (orgId, id, body) => api.patch(`${REVENUE}/offerings/${id}`, body, { headers: inOrg(orgId) }),
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
export const verticalOptions = (orgId, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, { status: 'active' }, { signal })
