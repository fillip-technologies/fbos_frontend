import { api, uuidv4 } from '@/shared/api/http.js'
import { INVENTORY } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

// The Inventory service is the Fixly backend. It holds one organization's hardware (the
// operator's); any other organization gets ORGANIZATION_NOT_SERVED. Lists are FBOS cursor
// pages ({ data, page: { next_cursor, has_more, limit, total? } }).
const ifMatch = (orgId, version, extra = {}) => inOrg(orgId, { 'If-Match': `"${version}"`, ...extra })
// Goods receipts and dispatches must never happen twice: one key per user action, so a
// request replayed after a token refresh returns the first answer.
const once = (key) => ({ 'Idempotency-Key': key || uuidv4() })

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
  // Product categories: each gives device codes their series (CAM-000123).
  categories: (orgId, { signal } = {}) => api.get(`${INVENTORY}/device-categories`, { headers: inOrg(orgId), signal }).then((r) => r.data),
  models: (orgId, { signal } = {}) => listAll(`${INVENTORY}/device-models`, orgId, {}, { signal }),
  createModel: (orgId, body) => api.post(`${INVENTORY}/device-models`, body, { headers: inOrg(orgId) }),
  updateModel: (orgId, id, body) => api.patch(`${INVENTORY}/device-models/${id}`, body, { headers: inOrg(orgId) }),
  vendors: (orgId, { signal } = {}) => listAll(`${INVENTORY}/vendors`, orgId, {}, { signal }),
  createVendor: (orgId, body) => api.post(`${INVENTORY}/vendors`, body, { headers: inOrg(orgId) }),
  updateVendor: (orgId, id, body) => api.patch(`${INVENTORY}/vendors/${id}`, body, { headers: inOrg(orgId) }),
}

export const purchaseOrdersApi = {
  // Filters: status, vendor_id, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/purchase-orders?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/purchase-orders/${id}`, { headers: inOrg(orgId), signal }),
  // { vendor_id, order_date?, expected_date?, currency?, notes?, items: [{ device_model_id, quantity_ordered, unit_price, tax_percent? }] }
  create: (orgId, body) => api.post(`${INVENTORY}/purchase-orders`, body, { headers: inOrg(orgId) }),
  update: (orgId, po, body) => api.patch(`${INVENTORY}/purchase-orders/${po.id}`, body, { headers: ifMatch(orgId, po.version) }),
  // move: submit | approve | cancel
  move: (orgId, po, move) => api.post(`${INVENTORY}/purchase-orders/${po.id}/${move}`, undefined, { headers: ifMatch(orgId, po.version) }),
  receipts: (orgId, poId, { signal } = {}) => listAll(`${INVENTORY}/goods-receipts`, orgId, { purchase_order_id: poId }, { signal }),
  // { purchase_order_id, receiving_location_id, vendor_invoice_no?, items: [{ purchase_order_item_id,
  //   quantity_received, quantity_accepted, quantity_rejected, rejection_reason?, units: [{ serial_number }] }] }
  receive: (orgId, body, key) => api.post(`${INVENTORY}/goods-receipts`, body, { headers: inOrg(orgId, once(key)) }),
}

export const transfersApi = {
  // Filters: status (comma list), transfer_type, location_id, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/stock-transfers?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/stock-transfers/${id}`, { headers: inOrg(orgId), signal }),
  // { transfer_type, from_location_id, to_location_id, device_ids, notes? }
  create: (orgId, body) => api.post(`${INVENTORY}/stock-transfers`, body, { headers: inOrg(orgId) }),
  approve: (orgId, t) => api.post(`${INVENTORY}/stock-transfers/${t.id}/approve`, undefined, { headers: ifMatch(orgId, t.version) }),
  // { challan_no?, carrier?, tracking_number? }
  dispatch: (orgId, t, body, key) => api.post(`${INVENTORY}/stock-transfers/${t.id}/dispatch`, body, { headers: ifMatch(orgId, t.version, once(key)) }),
  // { items?: [{ device_id, status: received | damaged | missing, condition_in? }] }
  receive: (orgId, t, body) => api.post(`${INVENTORY}/stock-transfers/${t.id}/receive`, body, { headers: ifMatch(orgId, t.version) }),
  cancel: (orgId, t, reason) => api.post(`${INVENTORY}/stock-transfers/${t.id}/cancel`, { reason }, { headers: ifMatch(orgId, t.version) }),
}

export const installationsApi = {
  // { device_id, zone_id, position_label?, latitude?, longitude? }
  install: (orgId, device, body) => api.post(`${INVENTORY}/installations`, { device_id: device.id, ...body }, { headers: ifMatch(orgId, device.version) }),
  remove: (orgId, installationId, reason) => api.post(`${INVENTORY}/installations/${installationId}/remove`, { reason }, { headers: inOrg(orgId) }),
}

export const issuesApi = {
  // Filters: status (comma list), priority, device_id, site_id, mine, overdue, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/issues?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/issues/${id}`, { headers: inOrg(orgId), signal }),
  categories: (orgId, deviceId, { signal } = {}) =>
    api.get(`${INVENTORY}/issue-categories${deviceId ? `?device_id=${deviceId}` : ''}`, { headers: inOrg(orgId), signal }).then((r) => r.data),
  technicians: (orgId, siteId, { signal } = {}) =>
    api.get(`${INVENTORY}/technicians${siteId ? `?site_id=${siteId}` : ''}`, { headers: inOrg(orgId), signal }).then((r) => r.data),
  // { device_id, category_id, priority, description }
  raise: (orgId, body) => api.post(`${INVENTORY}/issues`, body, { headers: inOrg(orgId) }),
  assign: (orgId, issue, technicianId) => api.post(`${INVENTORY}/issues/${issue.id}/assign`, { technician_id: technicianId }, { headers: ifMatch(orgId, issue.version) }),
  // { to_status, notes?, resolution_type? }
  move: (orgId, issue, body) => api.post(`${INVENTORY}/issues/${issue.id}/status`, body, { headers: ifMatch(orgId, issue.version) }),
  checkIn: (orgId, issueId, body = {}) => api.post(`${INVENTORY}/issues/${issueId}/visits`, body, { headers: inOrg(orgId) }),
  // { outcome, findings?, signatory_name? }
  checkOut: (orgId, visitId, body) => api.post(`${INVENTORY}/visits/${visitId}/check-out`, body, { headers: inOrg(orgId) }),
}

export const replacementsApi = {
  // { issue_id, reason, old_device_disposition, replacement_basis?, cost_borne_by? }
  request: (orgId, body) => api.post(`${INVENTORY}/replacements`, body, { headers: inOrg(orgId) }),
  approve: (orgId, id, body = {}) => api.post(`${INVENTORY}/replacements/${id}/approve`, body, { headers: inOrg(orgId) }),
  reject: (orgId, id, note) => api.post(`${INVENTORY}/replacements/${id}/reject`, { note }, { headers: inOrg(orgId) }),
  complete: (orgId, id, body = {}) => api.post(`${INVENTORY}/replacements/${id}/complete`, body, { headers: inOrg(orgId) }),
}

export const repairsApi = {
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/repair-orders?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${INVENTORY}/repair-orders/${id}`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${INVENTORY}/repair-orders`, body, { headers: inOrg(orgId) }),
  approve: (orgId, ro) => api.post(`${INVENTORY}/repair-orders/${ro.id}/approve`, undefined, { headers: ifMatch(orgId, ro.version) }),
  dispatch: (orgId, ro, body, key) => api.post(`${INVENTORY}/repair-orders/${ro.id}/dispatch`, body, { headers: ifMatch(orgId, ro.version, once(key)) }),
  arrived: (orgId, ro) => api.post(`${INVENTORY}/repair-orders/${ro.id}/arrived`, undefined, { headers: inOrg(orgId) }),
  // { outcome, return_location_id?, final_cost?, parts? }
  close: (orgId, ro, body) => api.post(`${INVENTORY}/repair-orders/${ro.id}/close`, body, { headers: ifMatch(orgId, ro.version) }),
  cancel: (orgId, ro) => api.post(`${INVENTORY}/repair-orders/${ro.id}/cancel`, undefined, { headers: ifMatch(orgId, ro.version) }),
}

export const disposalsApi = {
  list: (orgId, opts, { signal } = {}) => api.get(`${INVENTORY}/disposals?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  retire: (orgId, deviceId, reason) => api.post(`${INVENTORY}/devices/${deviceId}/retire`, { reason }, { headers: inOrg(orgId) }),
  request: (orgId, body) => api.post(`${INVENTORY}/disposals`, body, { headers: inOrg(orgId) }),
  decide: (orgId, id, approve, note) => api.post(`${INVENTORY}/disposals/${id}/${approve ? 'approve' : 'reject'}`, { note }, { headers: inOrg(orgId) }),
  // { data_wiped, certificate_document_id?, recovered_value? }
  complete: (orgId, id, body) => api.post(`${INVENTORY}/disposals/${id}/complete`, body, { headers: inOrg(orgId) }),
}

export const inventoryReportsApi = {
  get: (orgId, name, params = {}, { signal } = {}) =>
    api.get(`${INVENTORY}/reports/${name}?${new URLSearchParams(params)}`, { headers: inOrg(orgId), signal }).then((r) => r.data),
}
