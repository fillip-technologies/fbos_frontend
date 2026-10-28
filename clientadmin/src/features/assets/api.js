import { api } from '@/shared/api/http.js'
import { ASSETS } from '@/shared/api/paths.js'
import { inOrg, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version, extra = {}) => inOrg(orgId, { 'If-Match': `"${version}"`, ...extra })

const filters = (params = {}) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString()

// ---------- Asset Register & Operations ----------
export const assetsApi = {
  // Query filters: type_code, status, owner_unit_id, custodian_user_id, expiring_within_days, limit, cursor
  list: (orgId, opts, { signal } = {}) =>
    api.get(`${ASSETS}/assets?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),

  get: (orgId, id, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${id}`, { headers: inOrg(orgId), signal }),

  register: (orgId, body) =>
    api.post(`${ASSETS}/assets`, body, { headers: inOrg(orgId) }),

  update: (orgId, asset, body) =>
    api.patch(`${ASSETS}/assets/${asset.id}`, body, { headers: ifMatch(orgId, asset.version) }),

  // Custody
  assign: (orgId, asset, body) =>
    api.post(`${ASSETS}/assets/${asset.id}/assignments`, body, { headers: ifMatch(orgId, asset.version) }),

  transfer: (orgId, asset, body) =>
    api.post(`${ASSETS}/assets/${asset.id}/transfer`, body, { headers: ifMatch(orgId, asset.version) }),

  return: (orgId, asset, body) =>
    api.post(`${ASSETS}/assets/${asset.id}/return`, body, { headers: ifMatch(orgId, asset.version) }),

  history: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/history`, { headers: inOrg(orgId), signal }),

  clearance: (orgId, userId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/clearance/employee/${userId}`, { headers: inOrg(orgId), signal }),

  // Credentials
  revealCredential: (orgId, credentialId, body) =>
    api.post(`${ASSETS}/credentials/${credentialId}/reveal`, body, { headers: inOrg(orgId) }),

  // Maintenance
  scheduleMaintenance: (orgId, assetId, body) =>
    api.post(`${ASSETS}/assets/${assetId}/maintenance`, body, { headers: inOrg(orgId) }),

  completeMaintenance: (orgId, assetId, recordId, body) =>
    api.patch(`${ASSETS}/assets/${assetId}/maintenance/${recordId}`, body, { headers: inOrg(orgId) }),

  listMaintenance: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/maintenance`, { headers: inOrg(orgId), signal }),

  // Renewals
  createRenewal: (orgId, assetId, body) =>
    api.post(`${ASSETS}/assets/${assetId}/renewals`, body, { headers: inOrg(orgId) }),

  decideRenewal: (orgId, assetId, renewalId, body) =>
    api.post(`${ASSETS}/assets/${assetId}/renewals/${renewalId}/decide`, body, { headers: inOrg(orgId) }),

  listRenewals: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/renewals`, { headers: inOrg(orgId), signal }),

  // Decommission & Disposal
  dispose: (orgId, asset, body) =>
    api.post(`${ASSETS}/assets/${asset.id}/dispose`, body, { headers: ifMatch(orgId, asset.version) }),

  getDisposal: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/disposal`, { headers: inOrg(orgId), signal }),

  // Costs & TCO
  addCost: (orgId, assetId, body) =>
    api.post(`${ASSETS}/assets/${assetId}/costs`, body, { headers: inOrg(orgId) }),

  getCosts: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/costs`, { headers: inOrg(orgId), signal }),

  // Topology & Relationships
  createRelationship: (orgId, assetId, body) =>
    api.post(`${ASSETS}/assets/${assetId}/relationships`, body, { headers: inOrg(orgId) }),

  listRelationships: (orgId, assetId, { signal } = {}) =>
    api.get(`${ASSETS}/assets/${assetId}/relationships`, { headers: inOrg(orgId), signal }),
}

// ---------- Asset Master Data (Categories, Types, Vendors, Accounts) ----------
export const assetMasterApi = {
  categories: (orgId, params = {}, { signal } = {}) =>
    api.get(`${ASSETS}/asset-categories?${filters(params)}`, { headers: inOrg(orgId), signal }),

  createCategory: (orgId, body) =>
    api.post(`${ASSETS}/asset-categories`, body, { headers: inOrg(orgId) }),

  types: (orgId, params = {}, { signal } = {}) =>
    api.get(`${ASSETS}/asset-types?${filters(params)}`, { headers: inOrg(orgId), signal }),

  createType: (orgId, body) =>
    api.post(`${ASSETS}/asset-types`, body, { headers: inOrg(orgId) }),

  vendors: (orgId, params = {}, { signal } = {}) =>
    api.get(`${ASSETS}/vendors?${filters(params)}`, { headers: inOrg(orgId), signal }),

  createVendor: (orgId, body) =>
    api.post(`${ASSETS}/vendors`, body, { headers: inOrg(orgId) }),

  vendorAccounts: (orgId, params = {}, { signal } = {}) =>
    api.get(`${ASSETS}/vendor-accounts?${filters(params)}`, { headers: inOrg(orgId), signal }),

  createVendorAccount: (orgId, body) =>
    api.post(`${ASSETS}/vendor-accounts`, body, { headers: inOrg(orgId) }),
}
