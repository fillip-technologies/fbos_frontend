import { useState } from 'react'
import { deviceCatalogApi, disposalsApi, installationsApi, inventoryPlacesApi, issuesApi, repairsApi } from '@/features/inventory/api.js'
import ActionForm from '@/features/inventory/components/ActionForm.jsx'
import { DISPOSAL_METHOD_LABELS, PRIORITY_LABELS, REPAIR_TYPE_LABELS } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// What can be done with a device where it is now: install it from its site's store, or take
// it out of its zone. Moves between stores are transfers (Transfers page).
const IN_SERVICE = ['installed', 'under_maintenance', 'faulty', 'pending_replacement', 'in_client_stock', 'in_company_stock', 'in_platform_stock']
const RETIRABLE = ['in_platform_stock', 'in_company_stock', 'in_client_stock', 'faulty', 'pending_replacement', 'under_repair', 'at_vendor_rma']

export default function DeviceActions({ orgId, device, onChanged }) {
  const { user: me } = useAuth()
  const [mode, setMode] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const done = (changed) => { setMode(null); if (changed) onChanged() }
  const run = async (call) => {
    setBusy(true)
    setError(null)
    try {
      await call()
      invalidate(['devices', orgId])
      done(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  const canManage = hasAccess(me, ACCESS.manageDevices)
  const canInstall = canManage && device.lifecycle_state === 'in_client_stock' && device.site
  const canRemove = canManage && ['installed', 'faulty', 'pending_replacement'].includes(device.lifecycle_state) && device.installation
  const canRaise = hasAccess(me, ACCESS.manageDeviceIssues) && IN_SERVICE.includes(device.lifecycle_state)
  const canRepair = hasAccess(me, ACCESS.manageRepairOrders) && ['faulty', 'pending_replacement', 'in_client_stock', 'in_company_stock', 'in_platform_stock'].includes(device.lifecycle_state)
  const canRetire = hasAccess(me, ACCESS.manageDisposals) && !device.zone && RETIRABLE.includes(device.lifecycle_state)
  const canDispose = hasAccess(me, ACCESS.manageDisposals) && ['retired', 'lost'].includes(device.lifecycle_state)
  if (!(canInstall || canRemove || canRaise || canRepair || canRetire || canDispose)) return null
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 12 }}>
        {canRaise && <button className="btn" onClick={() => setMode('issue')}>Raise issue</button>}
        {canInstall && <button className="btn" onClick={() => setMode('install')}>Install in a zone</button>}
        {canRemove && <button className="btn secondary" onClick={() => setMode('remove')}>Take out of zone</button>}
        {canRepair && <button className="btn secondary" onClick={() => setMode('repair')}>Send for repair</button>}
        {canRetire && <button className="btn secondary" onClick={() => setMode('retire')}>Retire</button>}
        {canDispose && <button className="btn secondary" onClick={() => setMode('dispose')}>Request disposal</button>}
      </div>
      <ErrorBanner error={error} />
      {mode === 'install' && <InstallForm orgId={orgId} device={device} onDone={done} />}
      {mode === 'remove' && <RemoveForm orgId={orgId} device={device} onDone={done} />}
      {mode === 'issue' && <RaiseIssue orgId={orgId} device={device} busy={busy} run={run} onCancel={() => setMode(null)} />}
      {mode === 'repair' && <SendForRepair orgId={orgId} device={device} busy={busy} run={run} onCancel={() => setMode(null)} />}
      {mode === 'retire' && (
        <ActionForm title="Retire this device" busy={busy} onCancel={() => setMode(null)} fields={[{ name: 'reason', label: 'Why', required: true }]}
          onSubmit={(v) => run(() => disposalsApi.retire(orgId, device.id, v.reason))} />
      )}
      {mode === 'dispose' && (
        <ActionForm title="Request disposal" busy={busy} onCancel={() => setMode(null)}
          fields={[{ name: 'disposal_method', label: 'How', required: true, options: Object.entries(DISPOSAL_METHOD_LABELS) }, { name: 'reason', label: 'Why', textarea: true }]}
          onSubmit={(v) => run(() => disposalsApi.request(orgId, { device_id: device.id, ...v }))} />
      )}
    </>
  )
}

function RaiseIssue({ orgId, device, busy, run, onCancel }) {
  const categories = useLookup(['inventory-issue-categories', orgId, device.id], ({ signal }) => issuesApi.categories(orgId, device.id, { signal }), { enabled: Boolean(orgId) })
  return (
    <ActionForm title={`Raise an issue on ${device.code}`} busy={busy} onCancel={onCancel}
      fields={[
        { name: 'category_id', label: 'What is wrong', required: true, options: (categories.data ?? []).map((c) => [c.id, c.name]) },
        { name: 'priority', label: 'Priority', required: true, options: Object.entries(PRIORITY_LABELS) },
        { name: 'description', label: 'Describe it', required: true, textarea: true },
      ]}
      onSubmit={(v) => run(() => issuesApi.raise(orgId, { device_id: device.id, ...v }))} />
  )
}

function SendForRepair({ orgId, device, busy, run, onCancel }) {
  const vendors = useLookup(['vendors', orgId], ({ signal }) => deviceCatalogApi.vendors(orgId, { signal }), { enabled: Boolean(orgId) })
  return (
    <ActionForm title={`Send ${device.code} for repair`} busy={busy} onCancel={onCancel}
      fields={[
        { name: 'repair_type', label: 'Where', required: true, options: Object.entries(REPAIR_TYPE_LABELS) },
        { name: 'vendor_id', label: 'Vendor / service centre (not for the in-house bench)', options: (vendors.data ?? []).map((v) => [v.id, v.name]) },
        { name: 'is_warranty_claim', label: 'Warranty claim?', options: [['yes', 'Yes'], ['no', 'No']] },
        { name: 'rma_number', label: 'RMA number' },
        { name: 'cost_estimate', label: 'Estimated cost', type: 'number' },
      ]}
      onSubmit={(v) => run(() => repairsApi.create(orgId, {
        device_id: device.id, repair_type: v.repair_type, vendor_id: v.vendor_id, rma_number: v.rma_number,
        is_warranty_claim: v.is_warranty_claim === 'yes', cost_estimate: v.cost_estimate ? Number(v.cost_estimate) : undefined,
      }))} />
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
