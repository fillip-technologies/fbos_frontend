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
}
export const eventLabel = (type) => EVENT_LABELS[type] ?? type.replace(/_/g, ' ')

export const formatMoneyValue = (m) =>
  m ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: m.currency }).format(Number(m.amount)) : null
