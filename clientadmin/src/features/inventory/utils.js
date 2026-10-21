import { formatDate } from '@/shared/utils/format.js'

// Device lifecycle (Fixly v2 design §5): where a device is in its life. The badge class
// reuses the console's colours: stock = blue, moving = amber, in service = green,
// problem = red, end = grey.
export const LIFECYCLE_LABELS = {
  in_platform_stock: 'In warehouse',
  reserved: 'Reserved',
  in_transit: 'In transit',
  in_company_stock: 'In customer store',
  in_client_stock: 'In site store',
  installed: 'Installed',
  under_maintenance: 'Under maintenance',
  faulty: 'Faulty',
  pending_replacement: 'Pending replacement',
  under_repair: 'Under repair',
  at_vendor_rma: 'At vendor (RMA)',
  retired: 'Retired',
  disposed: 'Disposed',
  lost: 'Lost',
}

const LIFECYCLE_TONE = {
  in_platform_stock: 'issued',
  reserved: 'planned',
  in_transit: 'pending',
  in_company_stock: 'issued',
  in_client_stock: 'issued',
  installed: 'active',
  under_maintenance: 'in_progress',
  faulty: 'overdue',
  pending_replacement: 'on_hold',
  under_repair: 'on_hold',
  at_vendor_rma: 'on_hold',
  retired: 'retired',
  disposed: 'closed',
  lost: 'failed',
}
export const lifecycleTone = (state) => LIFECYCLE_TONE[state] ?? 'inactive'

export const LIFECYCLE_GROUPS = [
  ['Stock', ['in_platform_stock', 'reserved', 'in_company_stock', 'in_client_stock']],
  ['Moving', ['in_transit']],
  ['In service', ['installed', 'under_maintenance']],
  ['Problem', ['faulty', 'pending_replacement', 'under_repair', 'at_vendor_rma']],
  ['End', ['retired', 'disposed', 'lost']],
]

export const HEALTH_LABELS = { working: 'Working', not_working: 'Not working', needs_attention: 'Needs attention' }
export const healthTone = (h) => ({ working: 'active', not_working: 'overdue', needs_attention: 'pending' })[h] ?? 'inactive'

export const LOCATION_TYPE_LABELS = {
  platform_warehouse: 'Warehouse',
  company_store: 'Customer store',
  client_store: 'Site store',
  in_transit: 'In transit',
  vendor: 'Vendor',
  service_center: 'Service centre',
  disposal: 'Disposal',
}

export const OWNERSHIP_LABELS = {
  platform_owned: 'Ours (lent)',
  company_owned: 'Customer',
  client_owned: 'Site',
  leased: 'Leased',
}

export const EVENT_LABELS = {
  imported_from_v1: 'Imported from Fixly v1',
  registered: 'Registered',
  received: 'Received from vendor',
  allocated: 'Allocated',
  transferred: 'Transferred',
  dispatched: 'Dispatched',
  installed: 'Installed',
  relocated: 'Moved to another zone',
  removed_from_zone: 'Removed from zone',
  status_changed: 'Status changed',
  issue_raised: 'Issue raised',
  visit_done: 'Site visit',
  warranty_claimed: 'Warranty claimed',
  repair_sent: 'Sent for repair',
  repair_returned: 'Back from repair',
  replaced: 'Replaced',
  retired: 'Retired',
  disposed: 'Disposed',
  released: 'Released from a cancelled transfer',
  lost: 'Lost',
}
export const eventLabel = (type) => EVENT_LABELS[type] ?? type.replace(/_/g, ' ')

export const formatMoneyValue = (m) =>
  m ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: m.currency }).format(Number(m.amount)) : null

export const PO_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_received: 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
}

export const TRANSFER_TYPE_LABELS = {
  platform_to_company: 'Warehouse → customer',
  company_to_client: 'Customer → site',
  client_to_client: 'Site → site',
  return_to_company: 'Site → customer (return)',
  return_to_platform: 'Back to warehouse',
  replacement_dispatch: 'Replacement to site',
  to_repair: 'To repair',
  from_repair: 'Back from repair',
  to_vendor_rma: 'To vendor (RMA)',
  from_vendor_rma: 'Back from vendor',
}
// Which kinds of place each transfer type starts and ends at (mirrors the inventory service).
const STORES = ['platform_warehouse', 'company_store', 'client_store']
export const TRANSFER_ROUTES = {
  platform_to_company: [['platform_warehouse'], ['company_store']],
  company_to_client: [['company_store'], ['client_store']],
  client_to_client: [['client_store'], ['client_store']],
  return_to_company: [['client_store'], ['company_store']],
  return_to_platform: [['company_store', 'client_store'], ['platform_warehouse']],
  replacement_dispatch: [STORES, ['client_store']],
}

export const TRANSFER_STATUS_LABELS = {
  draft: 'Waiting for approval',
  approved: 'Approved',
  dispatched: 'In transit',
  received: 'Received',
  partially_received: 'Partly received',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}
export const transferTone = (s) => ({ draft: 'pending_approval', approved: 'approved', dispatched: 'in_progress', received: 'completed', partially_received: 'on_hold', cancelled: 'cancelled', rejected: 'rejected' })[s] ?? s
export const poTone = (s) => ({ partially_received: 'partially_paid', received: 'completed' })[s] ?? s

// The inventory service sends dates as full ISO timestamps; the console's formatDate takes a day.
export const formatDay = (iso) => formatDate(iso ? iso.slice(0, 10) : iso)

export const ISSUE_STATUS_LABELS = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In progress', on_hold: 'On hold',
  resolved: 'Resolved', closed: 'Closed', reopened: 'Reopened',
}
export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
export const priorityTone = (p) => ({ critical: 'p1', high: 'p2', medium: 'p3', low: 'p4' })[p]
export const WARRANTY_STATUS_LABELS = { in_warranty: 'In warranty', out_of_warranty: 'Out of warranty', unknown: 'Warranty unknown' }
export const warrantyTone = (w) => ({ in_warranty: 'active', out_of_warranty: 'expired' })[w] ?? 'inactive'
export const VISIT_OUTCOME_LABELS = {
  fixed: 'Fixed on site', needs_parts: 'Needs parts', needs_replacement: 'Needs replacement',
  needs_repair: 'Needs repair', not_reproducible: 'Could not reproduce', other: 'Other',
}
export const REPAIR_STATUS_LABELS = { requested: 'Requested', approved: 'Approved', sent: 'Out for repair', returned: 'Returned', closed: 'Closed', cancelled: 'Cancelled' }
export const REPAIR_TYPE_LABELS = { in_house: 'In-house bench', service_center: 'Service centre', vendor_rma: 'Vendor RMA' }
export const DISPOSAL_METHOD_LABELS = { scrap: 'Scrap', sold: 'Sold', recycled: 'Recycled', returned_to_vendor: 'Returned to vendor', donated: 'Donated' }
export const DISPOSITION_LABELS = { to_repair: 'Send for repair', vendor_rma: 'Back to the vendor (RMA)', return_to_stock: 'Back to stock (it works)', scrap: 'Scrap it' }
