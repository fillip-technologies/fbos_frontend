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

// "on_leave" -> "on leave": the words a status badge shows (colour comes from `.badge.<status>`).
export const statusLabel = (status) => (status ? String(status).replace(/_/g, ' ') : '')

export const todayISO = () => new Date().toISOString().split('T')[0]
