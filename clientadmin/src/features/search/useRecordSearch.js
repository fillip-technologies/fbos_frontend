import { useEffect, useState } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { searchApi } from '@/features/search/api.js'
import { useQuery } from '@/shared/api/useQuery.js'

const MIN_LENGTH = 2
const DEBOUNCE_MS = 250

// Kinds of record, in the order the search box lists them, with where each opens.
const KINDS = [
  { type: 'customer', label: 'Customers', path: (id) => `/customers/${id}` },
  { type: 'person', label: 'People', path: (id) => id },
  { type: 'project', label: 'Projects', path: (id) => `/projects/${id}` },
  { type: 'task', label: 'Tasks', path: (id) => `/tasks/${id}` },
  { type: 'lead', label: 'Leads', path: (id) => `/leads/${id}` },
  { type: 'opportunity', label: 'Opportunities', path: (id) => `/opportunities/${id}` },
  { type: 'quotation', label: 'Quotations', path: (id) => `/quotations/${id}` },
  { type: 'contract', label: 'Contracts', path: (id) => `/contracts/${id}` },
  { type: 'invoice', label: 'Invoices', path: (id) => `/invoices/${id}` },
  { type: 'payment', label: 'Payments', path: (id) => `/payments/${id}` },
]

const words = (s) => (s ? String(s).replace(/_/g, ' ') : null)
const join = (...parts) => parts.filter(Boolean).join(' · ') || null

function useDebounced(value, ms) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

/**
 * Records matching what someone typed, wherever they are kept, as one list grouped by kind:
 * { groups: [{ label, items: [{ id, label, description, to }] }], searching }.
 * Each place is asked only when the person may read it; one that fails is left out.
 */
export default function useRecordSearch(query) {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const q = useDebounced(query.trim(), DEBOUNCE_MS)
  const ready = Boolean(orgId) && q.length >= MIN_LENGTH && q === query.trim()
  const may = (rule) => ready && hasAccess(user, rule)
  const canSales = [ACCESS.customers, ACCESS.leads, ACCESS.opportunities, ACCESS.contracts, ACCESS.invoices, ACCESS.payments].some((r) => may(r))
  const canUsers = may(ACCESS.users)
  const canEmployees = !canUsers && may(ACCESS.people)

  const sources = {
    sales: useQuery(['search', orgId, 'sales', q], (o) => searchApi.sales(orgId, q, o), { enabled: canSales }),
    projects: useQuery(['search', orgId, 'projects', q], (o) => searchApi.projects(orgId, q, o), { enabled: may(ACCESS.projects) }),
    tasks: useQuery(['search', orgId, 'tasks', q], (o) => searchApi.tasks(orgId, q, o), { enabled: may(ACCESS.tasks) }),
    users: useQuery(['search', orgId, 'users', q], (o) => searchApi.users(orgId, q, o), { enabled: canUsers }),
    employees: useQuery(['search', orgId, 'employees', q], (o) => searchApi.employees(orgId, q, o), { enabled: canEmployees }),
  }
  const asked = { sales: canSales, projects: may(ACCESS.projects), tasks: may(ACCESS.tasks), users: canUsers, employees: canEmployees }

  const hits = []
  for (const h of sources.sales.data?.data ?? []) {
    const amount = h.amount ? Number(h.amount.amount).toLocaleString(undefined, { style: 'currency', currency: h.amount.currency, maximumFractionDigits: 0 }) : null
    hits.push({ type: h.type, id: h.id, label: h.title, description: join(h.subtitle, words(h.status), amount) })
  }
  for (const p of sources.projects.data?.data ?? []) {
    hits.push({ type: 'project', id: p.id, label: p.name, description: join(p.code, words(p.status)) })
  }
  for (const t of sources.tasks.data?.data ?? []) {
    hits.push({ type: 'task', id: t.id, label: t.title, description: join(t.code, words(t.status)) })
  }
  for (const u of sources.users.data?.data ?? []) {
    hits.push({ type: 'person', id: `/users/${u.id}`, label: u.name, description: u.email })
  }
  for (const w of sources.employees.data?.data ?? []) {
    const name = w.name || [w.first_name, w.last_name].filter(Boolean).join(' ')
    hits.push({ type: 'person', id: `/people/employees/${w.id}`, label: name, description: join(w.designation, w.worker_code) })
  }

  const groups = KINDS.map((kind) => ({
    label: kind.label,
    items: hits
      .filter((h) => h.type === kind.type)
      .map((h) => ({ id: `record:${h.type}:${h.id}`, label: h.label, description: h.description, to: kind.path(h.id), hint: kind.label })),
  })).filter((g) => g.items.length > 0)

  const searching = query.trim().length >= MIN_LENGTH && (!ready || Object.keys(sources).some((k) => asked[k] && sources[k].loading))
  return { groups, searching }
}
