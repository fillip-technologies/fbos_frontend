import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { devicesApi, inventoryPlacesApi, transfersApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { LOCATION_TYPE_LABELS, TRANSFER_ROUTES, TRANSFER_TYPE_LABELS } from '@/features/inventory/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

const IN_STOCK = 'in_platform_stock,in_company_stock,in_client_stock'

// Pick the kind of move, the two ends, then the devices from what is in stock at the source.
export default function TransferCreate() {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const locations = useLookup(['stock-locations', orgId], ({ signal }) => inventoryPlacesApi.locations(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const [type, setType] = useState('platform_to_company')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [picked, setPicked] = useState(new Set())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [fromTypes, toTypes] = TRANSFER_ROUTES[type]
  const all = (locations.data ?? []).filter((l) => l.is_active)
  const sources = all.filter((l) => fromTypes.includes(l.location_type))
  const from = all.find((l) => l.id === fromId)
  const targets = all.filter((l) => toTypes.includes(l.location_type) && l.id !== fromId && (type !== 'company_to_client' || l.customer_id === from?.customer_id))

  const stock = useQuery(
    ['devices', orgId, { location_id: fromId, picker: true }],
    ({ signal }) => devicesApi.list(orgId, { limit: 100, location_id: fromId, lifecycle_state: IN_STOCK }, { signal }),
    { enabled: Boolean(orgId && fromId) }
  )
  const devices = stock.data?.data ?? []
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const t = await transfersApi.create(orgId, { transfer_type: type, from_location_id: fromId, to_location_id: toId, device_ids: [...picked], notes: notes || undefined })
      invalidate(['stock-transfers', orgId])
      invalidate(['devices', orgId])
      navigate(`/inventory/transfers/${t.id}`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const label = (l) => `${l.name} · ${LOCATION_TYPE_LABELS[l.location_type]}`
  return (
    <form onSubmit={submit}>
      <div className="page-head">
        <h1>New transfer</h1>
        <button type="button" className="btn secondary" onClick={() => navigate('/inventory/transfers')}>Cancel</button>
      </div>
      <ErrorBanner error={error} />
      <div className="panel">
        <div className="grid-3">
          <label className="field">
            <span>Kind of move</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setFromId(''); setToId(''); setPicked(new Set()) }}>
              {Object.keys(TRANSFER_ROUTES).map((k) => <option key={k} value={k}>{TRANSFER_TYPE_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <select required value={fromId} onChange={(e) => { setFromId(e.target.value); setToId(''); setPicked(new Set()) }}>
              <option value="">Choose…</option>
              {sources.map((l) => <option key={l.id} value={l.id}>{label(l)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select required value={toId} onChange={(e) => setToId(e.target.value)} disabled={!fromId}>
              <option value="">Choose…</option>
              {targets.map((l) => <option key={l.id} value={l.id}>{label(l)}</option>)}
            </select>
          </label>
        </div>
      </div>
      {fromId && (
        <div className={`panel${stock.refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto', marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" aria-label="All" checked={devices.length > 0 && picked.size === devices.length}
                    onChange={(e) => setPicked(e.target.checked ? new Set(devices.map((d) => d.id)) : new Set())} />
                </th>
                <th>Device</th><th>Model</th><th>State</th>
              </tr>
            </thead>
            <tbody>
              {stock.loading ? <TableSkeleton cols={4} /> : devices.length === 0 ? (
                <tr><td colSpan={4} className="center-note">Nothing in stock here.</td></tr>
              ) : devices.map((d) => (
                <tr key={d.id} onClick={() => toggle(d.id)}>
                  <td><input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} onClick={(e) => e.stopPropagation()} /></td>
                  <td><span className="mono">{d.code}</span>{d.serial_number && <span className="muted small"> · S/N {d.serial_number}</span>}</td>
                  <td>{d.model?.name}</td>
                  <td><LifecycleBadge state={d.lifecycle_state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel" style={{ marginTop: 16 }}>
        <label className="field"><span>Notes</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy || picked.size === 0 || !toId} aria-busy={busy}>Create transfer of {picked.size} device(s)</button>
      </div>
    </form>
  )
}
