export const ASSET_STATUS_LABELS = {
  in_stock: 'In Stock',
  in_use: 'In Use',
  assigned: 'In Use',
  in_maintenance: 'In Maintenance',
  disposed: 'Disposed',
  reserved: 'Reserved',
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

export function resolveUserName(userId, users = []) {
  if (!userId) return null
  const u = (users || []).find((x) => x.id === userId)
  if (!u) return null
  return u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || userId
}

export function resolveUser(userId, users = []) {
  if (!userId) return null
  return (users || []).find((x) => x.id === userId) || null
}

export function resolveUnitName(unitId, units = []) {
  if (!unitId) return null
  const un = (units || []).find((x) => x.id === unitId)
  if (!un) return null
  return un.name ? `${un.name}${un.unit_type ? ` (${un.unit_type})` : ''}` : unitId
}

export function resolveUnit(unitId, units = []) {
  if (!unitId) return null
  return (units || []).find((x) => x.id === unitId) || null
}

export function resolveAssignee(assignee, users = [], units = []) {
  if (!assignee) return { name: null, subtext: null, typeLabel: null, isUser: false }
  const id = typeof assignee === 'object' ? assignee.id : assignee
  const type = typeof assignee === 'object' ? assignee.type : 'identity.user'
  const typeLabel = ASSIGNEE_TYPE_LABELS[type] || type || 'Assignee'

  if (type === 'identity.user' || !type) {
    const user = resolveUser(id, users)
    if (user) {
      const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || id
      return { name, subtext: user.email, typeLabel, user, unit: null, isUser: true }
    }
  }

  if (type === 'identity.org_unit') {
    const unit = resolveUnit(id, units)
    if (unit) {
      return { name: unit.name, subtext: unit.unit_type, typeLabel, user: null, unit, isUser: false }
    }
  }

  return { name: assignee.label || id, subtext: null, typeLabel, user: null, unit: null, isUser: false }
}
