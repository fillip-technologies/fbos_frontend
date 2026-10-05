import { api } from '@/shared/api/http.js'
import { IDENTITY, REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version) => inOrg(orgId, { 'If-Match': `"${version}"` })

// ---------- Customers (revenue "clients") and their contacts ----------
export const customersApi = {
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/clients?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  // Every customer, to name them next to service records.
  listAll: (orgId, { signal } = {}) => listAll(`${REVENUE}/clients`, orgId, {}, { signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${REVENUE}/clients/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${REVENUE}/clients`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) => api.patch(`${REVENUE}/clients/${id}`, body, { headers: ifMatch(orgId, version) }),
  addContact: (orgId, id, body) => api.post(`${REVENUE}/clients/${id}/contacts`, body, { headers: inOrg(orgId) }),
  // The company's active users, to pick a customer's owner. Needs identity.user.read.
  ownerOptions: (orgId, { signal } = {}) => listAll(`${IDENTITY}/users`, orgId, { status: 'active' }, { signal }),
}

// ---------- Outside services a customer uses (hosting, insurance, telecom...) ----------
export const clientServicesApi = {
  // Filters: client_id, provider_id, category_id, status, managed_by, renewal_within_days.
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/client-services?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  listForCustomer: (orgId, customerId, opts) =>
    api.get(`${REVENUE}/clients/${customerId}/services?${pageQuery(opts)}`, { headers: inOrg(orgId) }),
  create: (orgId, customerId, body) =>
    api.post(`${REVENUE}/clients/${customerId}/services`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) =>
    api.patch(`${REVENUE}/client-services/${id}`, body, { headers: ifMatch(orgId, version) }),
  remove: (orgId, id) => api.del(`${REVENUE}/client-services/${id}`, { headers: inOrg(orgId) }),
}

// ---------- Providers (Airtel, GoDaddy, LIC...) and categories ----------
export const providersApi = {
  list: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/service-providers?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  listAll: (orgId, { signal } = {}) => listAll(`${REVENUE}/service-providers`, orgId, {}, { signal }),
  create: (orgId, body) => api.post(`${REVENUE}/service-providers`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) =>
    api.patch(`${REVENUE}/service-providers/${id}`, body, { headers: ifMatch(orgId, version) }),
  remove: (orgId, id) => api.del(`${REVENUE}/service-providers/${id}`, { headers: inOrg(orgId) }),
}

export const categoriesApi = {
  // Active and inactive; a default set is created the first time a company lists them.
  list: (orgId, { signal } = {}) => listAll(`${REVENUE}/service-categories`, orgId, {}, { signal }),
  create: (orgId, body) => api.post(`${REVENUE}/service-categories`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, body) => api.patch(`${REVENUE}/service-categories/${id}`, body, { headers: inOrg(orgId) }),
}
