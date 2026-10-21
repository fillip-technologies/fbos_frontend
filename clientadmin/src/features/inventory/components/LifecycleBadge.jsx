import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { HEALTH_LABELS, LIFECYCLE_LABELS, healthTone, lifecycleTone } from '@/features/inventory/utils.js'

export function LifecycleBadge({ state }) {
  return <StatusBadge status={lifecycleTone(state)} label={LIFECYCLE_LABELS[state] ?? state} />
}

export function HealthBadge({ health }) {
  if (!health) return null
  return <StatusBadge status={healthTone(health)} label={HEALTH_LABELS[health]} />
}

export function WarrantyBadge({ endDate }) {
  if (!endDate) return <StatusBadge status="inactive" label="No warranty on file" />
  const days = Math.ceil((new Date(endDate) - new Date()) / 86_400_000)
  if (days < 0) return <StatusBadge status="expired" label="Warranty expired" />
  if (days <= 60) return <StatusBadge status="expiring" label={`Warranty ends in ${days} d`} />
  return <StatusBadge status="active" label="In warranty" />
}
