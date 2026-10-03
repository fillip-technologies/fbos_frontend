// Presentation helpers for user records.

export const USER_TYPE_LABELS = {
  employee: 'Employee',
  contractor: 'Contractor',
  client_user: 'Client user',
  client_admin: 'Client administrator',
}

// Types a client admin can invite. Client administrators are created only by the platform.
export const INVITABLE_USER_TYPES = [
  { value: 'employee', label: 'Employee', help: 'A member of staff on your payroll.' },
  { value: 'contractor', label: 'Contractor', help: 'An external person working with your team for a period.' },
  { value: 'client_user', label: 'Client user', help: 'Someone from one of your customers who needs limited access.' },
]

// Backend timestamps are ISO-8601 UTC; shown in the viewer's local time.
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
