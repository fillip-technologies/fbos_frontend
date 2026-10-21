import { useState } from 'react'
import { installationsApi, inventoryPlacesApi } from '@/features/inventory/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// What can be done with a device where it is now: install it from its site's store, or take
// it out of its zone. Moves between stores are transfers (Transfers page).
export default function DeviceActions({ orgId, device, onChanged }) {
  const { user: me } = useAuth()
  const [mode, setMode] = useState(null)
  if (!hasAccess(me, ACCESS.manageDevices)) return null
  const canInstall = device.lifecycle_state === 'in_client_stock' && device.site
  const canRemove = ['installed', 'faulty', 'pending_replacement'].includes(device.lifecycle_state) && device.installation
  if (!canInstall && !canRemove) return null
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 12 }}>
        {canInstall && mode !== 'install' && <button className="btn" onClick={() => setMode('install')}>Install in a zone</button>}
        {canRemove && mode !== 'remove' && <button className="btn secondary" onClick={() => setMode('remove')}>Take out of zone</button>}
      </div>
      {mode === 'install' && <InstallForm orgId={orgId} device={device} onDone={(changed) => { setMode(null); if (changed) onChanged() }} />}
      {mode === 'remove' && <RemoveForm orgId={orgId} device={device} onDone={(changed) => { setMode(null); if (changed) onChanged() }} />}
    </>
  )
}

function InstallForm({ orgId, device, onDone }) {
  const zones = useLookup(['inventory-zones', orgId, device.site.id], ({ signal }) => inventoryPlacesApi.zones(orgId, device.site.id, { signal }), { enabled: Boolean(orgId) })
  const leaves = (zones.data ?? []).filter((z) => z.child_count === 0 && z.status !== 'inactive')
  const [zoneId, setZoneId] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await installationsApi.install(orgId, device, { zone_id: zoneId, position_label: position || undefined })
      invalidate(['devices', orgId])
      onDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="panel" onSubmit={submit} style={{ marginBottom: 12 }}>
      <ErrorBanner error={error} />
      <div className="grid-2">
        <label className="field">
          <span>Zone at {device.site.name}</span>
          <select required value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Choose…</option>
            {leaves.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Exact spot</span><input placeholder="e.g. Main gate, pole 3" value={position} onChange={(e) => setPosition(e.target.value)} /></label>
      </div>
      <div className="row-actions">
        <button className="btn" disabled={busy} aria-busy={busy}>Install</button>
        <button type="button" className="btn secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  )
}

function RemoveForm({ orgId, device, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await installationsApi.remove(orgId, device.installation.id, reason)
      invalidate(['devices', orgId])
      onDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="panel" onSubmit={submit} style={{ marginBottom: 12 }}>
      <ErrorBanner error={error} />
      <label className="field">
        <span>Why it comes out (it goes back to {device.site?.name ?? 'the site'} store)</span>
        <input required value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="row-actions">
        <button className="btn" disabled={busy} aria-busy={busy}>Take out</button>
        <button type="button" className="btn secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  )
}
