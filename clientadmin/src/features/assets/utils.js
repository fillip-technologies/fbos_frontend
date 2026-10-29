export const ASSET_STATUS_LABELS = {
  in_stock: 'In Stock',
  assigned: 'Assigned',
  in_maintenance: 'In Maintenance',
  disposed: 'Disposed',
}

export const CRITICALITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const FAMILY_LABELS = {
  hardware: 'Hardware',
  software: 'Software',
  facility: 'Facility',
  credential: 'Credential',
  vehicle: 'Vehicle',
}

export const ASSIGNEE_TYPE_LABELS = {
  'identity.user': 'Employee / User',
  'identity.org_unit': 'Department / Branch',
  'delivery.work_unit': 'Project / Work Unit',
}

export const MAINTENANCE_TYPE_LABELS = {
  preventive: 'Preventive Maintenance',
  repair: 'Repair & Fix',
  calibration: 'Calibration',
  inspection: 'Inspection & Audit',
  upgrade: 'Hardware / OS Upgrade',
}

export const DISPOSAL_METHOD_LABELS = {
  scrapped: 'Scrapped / Recycled',
  sold: 'Sold (Liquidation / Salvage)',
  recycled: 'E-Waste Recycled',
  donated: 'Donated to Charity',
  returned_to_lessor: 'Returned to Lessor (Lease End)',
}

export const COST_TYPE_LABELS = {
  acquisition: 'Acquisition / Purchase',
  lease: 'Lease / Rental Payment',
  maintenance: 'Maintenance / Servicing',
  license: 'Subscription / License',
  repair: 'Repair / Parts Replacement',
}

export const RELATION_TYPE_LABELS = {
  parent_of: 'Parent of (Child hardware / component)',
  depends_on: 'Depends on (Infrastructure dependency)',
  installed_on: 'Installed on (Software on host device)',
  backup_for: 'Backup / Failover for',
}

export function formatMoney(val) {
  if (!val) return '—'
  const amount = typeof val === 'object' ? val.amount : val
  const currency = typeof val === 'object' ? val.currency || 'INR' : 'INR'
  const num = typeof amount === 'number' ? amount : parseFloat(amount)
  if (isNaN(num)) return '—'
  return `${currency} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
