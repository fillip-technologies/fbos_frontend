export function formatCurrency(amount, currency = 'USD') {
  if (amount == null || amount === '') return '-'
  const num = Number(amount)
  if (Number.isNaN(num)) return '-'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${currency || '$'} ${num.toFixed(2)}`
  }
}

export function formatDate(val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(val)
  }
}

export function formatDateTime(val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(val)
  }
}

export function toList(res) {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data)) return res.data
  return []
}

export function toItem(res) {
  if (!res) return null
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data
  return res
}

export const WORKER_STATUS_BADGES = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  probation: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  on_leave: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  noticed: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  exited: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

export const ATTENDANCE_STATUS_BADGES = {
  present: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  half_day: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  absent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  holiday: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  on_leave: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  regularized: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}

export const REQUISITION_STATUS_BADGES = {
  open: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  filled: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}
