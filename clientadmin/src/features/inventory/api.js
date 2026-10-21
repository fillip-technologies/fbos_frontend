import { api } from '@/shared/api/http.js'
import { INVENTORY } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

// The Inventory service is the Fixly backend. It holds one organization's hardware (the
// operator's); any other organization gets ORGANIZATION_NOT_SERVED. Lists are FBOS cursor
// pages ({ data, page: { next_cursor, has_more, limit, total? } }).
const ifMatch = (orgId, version) => inOrg(orgId, { 'If-Match': `"${version}"` })

export const devicesApi = {
  // Filters: q, lifecycle_state (comma list), health_status, model_id, customer_id, site_id,
  // zone_id, location_id, warranty (active | expired | none), sort.
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/devices?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/devices/${id}`, { headers: inOrg(orgId), signal }),
  events: (orgId, id, opts, { signal } = {}) =>
    api.get(`${INVENTORY}/devices/${id}/events?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  installations: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/devices/${id}/installations`, { headers: inOrg(orgId), signal }),
  warranties: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/devices/${id}/warranties`, { headers: inOrg(orgId), signal }),
  documents: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/devices/${id}/documents`, { headers: inOrg(orgId), signal }),
  // { document_id, doc_type, title? } — a file already uploaded to Documents for this device.
  linkDocument: (orgId, id, body) => api.post(`${INVENTORY}/devices/${id}/documents`, body, { headers: inOrg(orgId) }),
  update: (orgId, device, body) => api.patch(`${INVENTORY}/devices/${device.id}`, body, { headers: ifMatch(orgId, device.version) }),
}

export const inventoryPlacesApi = {
  customers: (orgId, { signal } = {}) => listAll(`${INVENTORY}/customers`, orgId, {}, { signal }),
  sites: (orgId, { signal } = {}) => listAll(`${INVENTORY}/sites`, orgId, {}, { signal }),
  zones: (orgId, siteId, { signal } = {}) => listAll(`${INVENTORY}/zones`, orgId, { site_id: siteId }, { signal }),
  locations: (orgId, opts = {}, { signal } = {}) => listAll(`${INVENTORY}/stock-locations`, orgId, opts, { signal }),
  stock: (orgId, locationId, { signal } = {}) => api.get(`${INVENTORY}/stock-locations/${locationId}/stock`, { headers: inOrg(orgId), signal }),
}

export const deviceCatalogApi = {
  models: (orgId, { signal } = {}) => listAll(`${INVENTORY}/device-models`, orgId, {}, { signal }),
  vendors: (orgId, { signal } = {}) => listAll(`${INVENTORY}/vendors`, orgId, {}, { signal }),
}
