import { useEffect, useState } from 'react'
import { verticalOptions } from '@/features/sales/api.js'

// The client's active verticals, to pick one for a lead or offering and to name them
// (revenue stores only the id).
export default function useVerticals(orgId) {
  const [verticals, setVerticals] = useState([])

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    verticalOptions(orgId)
      .then((list) => !cancelled && setVerticals(list))
      .catch(() => !cancelled && setVerticals([]))
    return () => {
      cancelled = true
    }
  }, [orgId])

  const verticalName = (id) => verticals.find((v) => v.id === id)?.name
  return { verticals, verticalName }
}
