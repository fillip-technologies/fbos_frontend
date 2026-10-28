import { ASSET_STATUS_LABELS, CRITICALITY_LABELS, FAMILY_LABELS } from '@/features/assets/utils.js'

export function AssetStatusBadge({ status }) {
  const code = (status || 'in_stock').toLowerCase()
  const label = ASSET_STATUS_LABELS[code] || status
  return <span className={`badge ${code}`}>{label}</span>
}

export function CriticalityBadge({ criticality }) {
  const code = (criticality || 'medium').toLowerCase()
  const label = CRITICALITY_LABELS[code] || criticality
  return <span className={`badge ${code}`}>{label}</span>
}

export function FamilyBadge({ family }) {
  const code = (family || 'hardware').toLowerCase()
  const label = FAMILY_LABELS[code] || family
  return <span className="badge draft">{label}</span>
}
