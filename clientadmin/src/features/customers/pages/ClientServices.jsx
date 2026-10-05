import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clientServicesApi, customersApi } from '@/features/customers/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import ServicesTable from '@/features/customers/components/ServicesTable.jsx'
import useServiceCatalog from '@/features/customers/useServiceCatalog.js'
import { MANAGED_BY, SERVICE_STATUSES, capitalize } from '@/features/customers/utils.js'

const RENEWAL_WINDOWS = [
  ['', 'Any renewal date'],
  ['7', 'Renewing within 7 days'],
  ['30', 'Renewing within 30 days'],
  ['90', 'Renewing within 90 days'],
]
const NO_FILTERS = { provider_id: '', category_id: '', status: 'active', managed_by: '', renewal_within_days: '' }

// Outside services across every customer: who uses a provider, what renews soon.
export default function ClientServices() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const catalog = useServiceCatalog(orgId)
  const [customerNames, setCustomerNames] = useState({})

  const [services, setServices] = useState([])
  const [filters, setFilters] = useState(NO_FILTERS)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Records carry only the customer's id; name them when customers may be read.
  useEffect(() => {
    if (!orgId || !hasAccess(me, ACCESS.customers)) return
    customersApi
      .listAll(orgId)
      .then((all) => setCustomerNames(Object.fromEntries(all.map((c) => [c.id, c.name]))))
      .catch(() => setCustomerNames({}))
  }, [orgId, me])

  function load() {
    if (!orgId) return
    setLoading(true)
    setError(null)
    clientServicesApi
      .list(orgId, { limit: 25, cursor, ...filters })
      .then((res) => {
        setServices(res.data)
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }
  useEffect(load, [orgId, cursor, filters])

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (k, v) => {
    resetPaging()
    setFilters((f) => ({ ...f, [k]: v }))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Client services</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Hosting, domains, insurance and other outside services your customers use. Add them from a customer's
            Services tab.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          <Link className="btn secondary" to="/service-providers">Providers &amp; categories</Link>
        </div>
      </div>

      <div className="toolbar">
        <select value={filters.renewal_within_days} onChange={(e) => setFilter('renewal_within_days', e.target.value)}>
          {RENEWAL_WINDOWS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.provider_id} onChange={(e) => setFilter('provider_id', e.target.value)}>
          <option value="">Any provider</option>
          {catalog.providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
          <option value="">Any category</option>
          {catalog.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={filters.managed_by} onChange={(e) => setFilter('managed_by', e.target.value)}>
          <option value="">Managed by anyone</option>
          {Object.entries(MANAGED_BY).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {SERVICE_STATUSES.map((s) => (
            <option key={s} value={s}>{capitalize(s)}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={load} />
      <ServicesTable services={services} loading={loading} customerName={(id) => customerNames[id]} />
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
