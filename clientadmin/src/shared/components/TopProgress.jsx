import { useEffect, useState } from 'react'
import { onActivity, requestsInFlight } from '@/shared/api/activity.js'
import { useDelayedFlag } from '@/shared/utils/useDelayedFlag.js'

// A thin bar across the top of the window while any request is in flight. It appears
// only after 150 ms, so quick calls never flash it.
export default function TopProgress() {
  const [busy, setBusy] = useState(() => requestsInFlight() > 0)
  useEffect(() => onActivity((count) => setBusy(count > 0)), [])
  const shown = useDelayedFlag(busy, 150)
  return <div className={`top-progress${shown ? ' active' : ''}`} role="progressbar" aria-hidden={!shown} />
}
