import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { deviceCatalogApi, devicesApi, inventoryPlacesApi } from '@/features/inventory/api.js'
import { HealthBadge, LifecycleBadge, WarrantyBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { LIFECYCLE_GROUPS, LIFECYCLE_LABELS } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { prefetch, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

const FILTER_KEYS = ['q', 'lifecycle_state', 'customer_id', 'site_id', 'model_id', 'warranty', 'location_id']

// The device register: every physical unit, where it is and who holds it. Customer staff
// get the same page with only their site's devices (the inventory service filters).
export default function Devices() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['devices', orgId, { cursor, filters }],
    ({ signal }) => devicesApi.list(orgId, { limit: 25, cursor, ...filters }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const customers = useLookup(['inventory-customers', orgId], ({ signal }) => inventoryPlacesApi.customers(orgId, { signal }), { enabled: Boolean(orgId) })
  const sites = useLookup(['inventory-sites', orgId], ({ signal }) => inventoryPlacesApi.sites(orgId, { signal }), { enabled: Boolean(orgId) })
  const canSeeCatalog = hasAccess(me, ACCESS.deviceCatalog)
  const models = useLookup(['device-models', orgId], ({ signal }) => deviceCatalogApi.models(orgId, { signal }), {
    enabled: Boolean(orgId) && canSeeCatalog,
  })

  const devices = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function setFilter(key, value) {
    setCursor(undefined)
    setStack([])
    const nextParams = new URLSearchParams(params)
    if (value) nextParams.set(key, value)
    else nextParams.delete(key)
    setParams(nextParams, { replace: true })
  }
  const warm = (id) => prefetch(['device', orgId, id], ({ signal }) => devicesApi.get(orgId, id, { signal }))
  const visibleSites = (sites.data ?? []).filter((s) => !filters.customer_id || s.customer_id === filters.customer_id)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Devices</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Every unit {activeOrg ? `“${activeOrg.name}”` : 'this company'} supplies: where it is, who holds it, its warranty.
            {data?.page?.total != null && ` ${data.page.total} in this view.`}
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setCursor(undefined)} />
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search code, name or serial" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
        <select value={filters.lifecycle_state} onChange={(e) => setFilter('lifecycle_state', e.target.value)}>
          <option value="">Any state</option>
          {LIFECYCLE_GROUPS.map(([group, states]) => (
            <optgroup key={group} label={group}>
              <option value={states.join(',')}>All {group.toLowerCase()}</option>
              {states.map((s) => (
                <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {(customers.data?.length ?? 0) > 1 && (
          <select value={filters.customer_id} onChange={(e) => setFilter('customer_id', e.target.value)}>
            <option value="">Any customer</option>
            {customers.data.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {visibleSites.length > 1 && (
          <select value={filters.site_id} onChange={(e) => setFilter('site_id', e.target.value)}>
            <option value="">Any site</option>
            {visibleSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {models.data?.length > 0 && (
          <select value={filters.model_id} onChange={(e) => setFilter('model_id', e.target.value)}>
            <option value="">Any model</option>
            {models.data.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <select value={filters.warranty} onChange={(e) => setFilter('warranty', e.target.value)}>
          <option value="">Any warranty</option>
          <option value="active">In warranty</option>
          <option value="expired">Warranty expired</option>
          <option value="none">No warranty on file</option>
        </select>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Model</th>
              <th>State</th>
              <th>Where</th>
              <th>Customer / site</th>
              <th>Warranty</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : devices.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No devices found.</td></tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} onClick={() => navigate(`/inventory/devices/${d.id}`)} onMouseEnter={() => warm(d.id)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div className="muted small">
                      <span className="mono">{d.code}</span>
                      {d.serial_number && <> · S/N <span className="mono">{d.serial_number}</span></>}
                    </div>
                  </td>
                  <td>{d.model?.name ?? d.category_name ?? <span className="muted">—</span>}</td>
                  <td>
                    <LifecycleBadge state={d.lifecycle_state} /> <HealthBadge health={d.health_status} />
                  </td>
                  <td>{d.zone?.name ?? d.location?.name ?? <span className="muted">In transit</span>}</td>
                  <td>
                    <div>{d.customer?.name ?? <span className="muted">—</span>}</div>
                    {d.site && <div className="muted small">{d.site.name}</div>}
                  </td>
                  <td><WarrantyBadge endDate={d.warranty_end_date} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
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
