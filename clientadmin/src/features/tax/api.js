import { api } from '@/shared/api/http.js'
import { REVENUE } from '@/shared/api/paths.js'
import { inOrg } from '@/shared/api/query.js'

const ifMatch = (orgId, version, extra = {}) => inOrg(orgId, { 'If-Match': `"${version}"`, ...extra })
const query = (params) => {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') search.set(k, v)
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ---------- Tax configuration: dated entries of every kind (rates, rules, categories...) ----------
export const taxConfigApi = {
  // Filters: kind, code, as_of (entries in effect that day).
  entries: (orgId, params, { signal } = {}) =>
    api.get(`${REVENUE}/tax/config-entries${query(params)}`, { headers: inOrg(orgId), signal }),
  // body: { kind, code, effective_from, effective_to?, data, supersedes_id? }
  create: (orgId, body) => api.post(`${REVENUE}/tax/config-entries`, body, { headers: inOrg(orgId) }),
  // body: { effective_to?, data?, clear_effective_to? } — an entry in effect only takes a new effective_to.
  update: (orgId, entry, body) =>
    api.patch(`${REVENUE}/tax/config-entries/${entry.id}`, body, { headers: ifMatch(orgId, entry.version) }),
  remove: (orgId, entry) => api.del(`${REVENUE}/tax/config-entries/${entry.id}`, { headers: ifMatch(orgId, entry.version) }),
  revisions: (orgId, { signal } = {}) => api.get(`${REVENUE}/tax/config-revisions`, { headers: inOrg(orgId), signal }),
  // Taxes for lines, saving nothing: the editors' preview.
  calculate: (orgId, body) => api.post(`${REVENUE}/tax/calculations`, body, { headers: inOrg(orgId) }),
}

// ---------- Packs: versioned tax configuration shipped with the service ----------
export const taxPacksApi = {
  list: (orgId, { signal } = {}) => api.get(`${REVENUE}/tax/packs`, { headers: inOrg(orgId), signal }),
  diff: (orgId, code, version, { signal } = {}) =>
    api.get(`${REVENUE}/tax/packs/${code}/versions/${version}/diff`, { headers: inOrg(orgId), signal }),
  // body: { pack, version, overwrite: [{ kind, code, effective_from }] }
  apply: (orgId, body) => api.post(`${REVENUE}/tax/pack-applications`, body, { headers: inOrg(orgId) }),
  applications: (orgId, { signal } = {}) => api.get(`${REVENUE}/tax/pack-applications`, { headers: inOrg(orgId), signal }),
}

// ---------- The organization's own registrations (a GSTIN per state) ----------
export const taxRegistrationsApi = {
  list: (orgId, { signal } = {}) => api.get(`${REVENUE}/tax-registrations`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${REVENUE}/tax-registrations`, body, { headers: inOrg(orgId) }),
  update: (orgId, registration, body) =>
    api.patch(`${REVENUE}/tax-registrations/${registration.id}`, body, { headers: ifMatch(orgId, registration.version) }),
}

// ---------- Billing settings (finance_settings): version 0 until first saved ----------
export const financeSettingsApi = {
  get: (orgId, { signal } = {}) => api.get(`${REVENUE}/finance-settings`, { headers: inOrg(orgId), signal }),
  update: (orgId, settings, body) =>
    api.patch(`${REVENUE}/finance-settings`, body, { headers: ifMatch(orgId, settings.version) }),
}

// ---------- Receivables: TDS customers withheld, and GST owed vs cash collected ----------
export const taxReportsApi = {
  // Filters: client_id, status, fiscal_year.
  tdsReceivables: (orgId, params, { signal } = {}) =>
    api.get(`${REVENUE}/tds-receivables${query(params)}`, { headers: inOrg(orgId), signal }),
  updateTdsReceivable: (orgId, receivable, body) =>
    api.patch(`${REVENUE}/tds-receivables/${receivable.id}`, body, { headers: ifMatch(orgId, receivable.version) }),
  gstVsCash: (orgId, period, { signal } = {}) =>
    api.get(`${REVENUE}/reports/gst-vs-cash${query({ period })}`, { headers: inOrg(orgId), signal }),
}
