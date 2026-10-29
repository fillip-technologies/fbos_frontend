import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetMasterApi, assetsApi } from '@/features/assets/api.js'
import { AssetStatusBadge, CriticalityBadge } from '@/features/assets/components/AssetBadge.jsx'
import CreateAssetTypeModal from '@/features/assets/components/CreateAssetTypeModal.jsx'
import { ASSET_STATUS_LABELS, formatDate, resolveAssignee, resolveUnitName } from '@/features/assets/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { usersApi } from '@/features/users/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { prefetch, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

const FILTER_KEYS = ['status', 'type_code', 'owner_unit_id']

export default function AssetList() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [showTypeModal, setShowTypeModal] = useState(false)

  const { data, error, loading, refreshing, reload } = useQuery(
    ['assets', orgId, { cursor, filters }],
    ({ signal }) =>
      assetsApi.list(
        orgId,
        {
          limit: 25,
          cursor,
          status: filters.status || undefined,
          type_code: filters.type_code || undefined,
          owner_unit_id: filters.owner_unit_id || undefined,
        },
        { signal }
      ),
    { enabled: Boolean(orgId), keepPrevious: true }
  )

  const types = useLookup(
    ['asset-types', orgId],
    ({ signal }) => assetMasterApi.types(orgId, {}, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const units = useLookup(
    ['org-units', orgId, 'all'],
    ({ signal }) => orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const users = useLookup(
    ['users', orgId, 'all'],
    ({ signal }) => usersApi.list(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const assets = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function setFilter(key, value) {
    setCursor(undefined)
    setStack([])
    const nextParams = new URLSearchParams(params)
    if (value) nextParams.set(key, value)
    else nextParams.delete(key)
    setParams(nextParams, { replace: true })
  }

  const warm = (id) => prefetch(['asset', orgId, id], ({ signal }) => assetsApi.get(orgId, id, { signal }))
  const canRegister = hasAccess(me, ACCESS.manageAssets)
  const canManageSetup = hasAccess(me, ACCESS.assetsSetup) || canRegister

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Company Assets</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Hardware, IT equipment, software licenses, facilities and digital assets of {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setCursor(undefined)} />
          {canManageSetup && (
            <button className="btn secondary" onClick={() => setShowTypeModal(true)}>
              + Asset Type
            </button>
          )}
          {canRegister && (
            <button className="btn" onClick={() => navigate('/assets/new')}>
              + Register Asset
            </button>
          )}
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(ASSET_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>

        <select value={filters.type_code} onChange={(e) => setFilter('type_code', e.target.value)}>
          <option value="">All asset types</option>
          {(types.data || []).map((t) => (
            <option key={t.code} value={t.code}>{t.name} ({t.family})</option>
          ))}
        </select>

        <select value={filters.owner_unit_id} onChange={(e) => setFilter('owner_unit_id', e.target.value)}>
          <option value="">All departments & branches</option>
          {(units.data || []).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={reload} />

      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Status</th>
              <th>Current Custody</th>
              <th>Department / Branch</th>
              <th>Expiry / Warranty</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : assets.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No assets match the current filters.</td></tr>
            ) : (
              assets.map((a) => (
                <tr
                  key={a.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/assets/${a.id}`)}
                  onMouseEnter={() => warm(a.id)}
                >
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="muted small">
                      <span className="mono">{a.asset_tag}</span>
                      {a.serial_no && <> · S/N <span className="mono">{a.serial_no}</span></>}
                    </div>
                  </td>
                  <td>
                    <div>{a.type?.name}</div>
                    <div className="muted small" style={{ textTransform: 'capitalize' }}>{a.type?.family}</div>
                  </td>
                  <td>
                    <AssetStatusBadge status={a.status} /> <CriticalityBadge criticality={a.criticality} />
                  </td>
                  <td>
                    {a.custody ? (() => {
                      const res = resolveAssignee(a.custody, users.data, units.data)
                      return (
                        <div>
                          <div><strong>{res.name}</strong></div>
                          <div className="muted small">{res.typeLabel}</div>
                        </div>
                      )
                    })() : (
                      <span className="muted">In Stock</span>
                    )}
                  </td>
                  <td>{resolveUnitName(a.owner_unit_id || a.owner_unit?.id, units.data) || a.owner_unit?.name || <span className="muted">—</span>}</td>
                  <td>{a.expires_at ? formatDate(a.expires_at) : <span className="muted">—</span>}</td>
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

      {showTypeModal && (
        <CreateAssetTypeModal
          orgId={orgId}
          onClose={() => setShowTypeModal(false)}
          onCreated={(created) => {
            setFilter('type_code', created.code)
            setShowTypeModal(false)
          }}
        />
      )}
    </div>
  )
}
