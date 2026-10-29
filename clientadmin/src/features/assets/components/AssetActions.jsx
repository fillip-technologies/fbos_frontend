import { useState } from 'react'
import { assetsApi, assetMasterApi } from '@/features/assets/api.js'
import {
  ASSIGNEE_TYPE_LABELS,
  DISPOSAL_METHOD_LABELS,
  MAINTENANCE_TYPE_LABELS,
} from '@/features/assets/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { usersApi } from '@/features/users/api.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

export default function AssetActions({ orgId, asset, onChanged }) {
  const { user: me } = useAuth()
  const [mode, setMode] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState(null)

  const done = (changed) => {
    setMode(null)
    if (changed) onChanged()
  }

  const run = async (call) => {
    setBusy(true)
    setError(null)
    try {
      await call()
      invalidate(['assets', orgId])
      invalidate(['asset', orgId, asset.id])
      done(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const canAssign = hasAccess(me, ACCESS.assignAssets)
  const canMaintain = hasAccess(me, ACCESS.maintainAssets)
  const canDispose = hasAccess(me, ACCESS.disposeAssets)
  const canReveal = hasAccess(me, ACCESS.revealAssetCredentials)

  const isAssigned = asset.status === 'assigned' || asset.status === 'in_use'
  const isInStock = asset.status === 'in_stock' || asset.status === 'available'
  const isInMaintenance = asset.status === 'in_maintenance'
  const isDisposed = asset.status === 'disposed'
  const isCredential = asset.type?.family === 'credential'

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="row-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
        {canAssign && isInStock && (
          <button className="btn" onClick={() => setMode('assign')}>
            Assign asset
          </button>
        )}
        {canAssign && isAssigned && (
          <>
            <button className="btn secondary" onClick={() => setMode('transfer')}>
              Transfer / Reassign
            </button>
            <button className="btn secondary" onClick={() => setMode('return')}>
              Return to stock
            </button>
          </>
        )}
        {canMaintain && !isDisposed && !isInMaintenance && (
          <button className="btn secondary" onClick={() => setMode('maintenance')}>
            Schedule maintenance
          </button>
        )}
        {canDispose && !isDisposed && (
          <button className="btn secondary" onClick={() => setMode('dispose')}>
            Decommission & dispose
          </button>
        )}
        {isCredential && canReveal && (
          <button className="btn secondary" onClick={() => setMode('reveal')}>
            Reveal credential
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {revealedSecret && (
        <div className="alert info" style={{ marginTop: 12 }}>
          <strong>Credential Secret:</strong>
          <pre style={{ margin: '8px 0 0', padding: 8, background: '#fff', borderRadius: 4, userSelect: 'all' }}>
            {revealedSecret.value}
          </pre>
          <div className="muted small" style={{ marginTop: 6 }}>
            Expires in {revealedSecret.expires_in || 60} seconds. Keep this secret safe.
            <button
              className="btn secondary small"
              style={{ marginLeft: 12 }}
              onClick={() => setRevealedSecret(null)}
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {mode === 'assign' && (
        <AssignForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          run={run}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'transfer' && (
        <TransferForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          run={run}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'return' && (
        <ReturnForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          run={run}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'maintenance' && (
        <MaintenanceForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          run={run}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'dispose' && (
        <DisposeForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          run={run}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'reveal' && (
        <RevealSecretForm
          orgId={orgId}
          asset={asset}
          busy={busy}
          onCancel={() => setMode(null)}
          onRevealed={(secret) => {
            setRevealedSecret(secret)
            setMode(null)
          }}
        />
      )}
    </div>
  )
}

function AssignForm({ orgId, asset, busy, run, onCancel }) {
  const users = useLookup(['users', orgId, 'active'], ({ signal }) =>
    usersApi.list(orgId, { limit: 100, status: 'active' }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )
  const units = useLookup(['org-units', orgId, 'all'], ({ signal }) =>
    orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const [assigneeType, setAssigneeType] = useState('identity.user')
  const [assigneeId, setAssigneeId] = useState('')
  const [custodianUserId, setCustodianUserId] = useState('')
  const [conditionOut, setConditionOut] = useState('Good')
  const [note, setNote] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!assigneeId) return
    run(() =>
      assetsApi.assign(orgId, asset, {
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        custodian_user_id: custodianUserId || undefined,
        condition_out: conditionOut,
        note: note || undefined,
      })
    )
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Assign {asset.asset_tag} ({asset.name})</h3>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Assignee Type</span>
          <select value={assigneeType} onChange={(e) => { setAssigneeType(e.target.value); setAssigneeId('') }}>
            {Object.entries(ASSIGNEE_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Assignee</span>
          {assigneeType === 'identity.user' ? (
            <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Select Employee / User…</option>
              {(users.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          ) : assigneeType === 'identity.org_unit' ? (
            <select required value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Select Department / Branch…</option>
              {(units.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required
              placeholder="UUID of project / work unit"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            />
          )}
        </label>

        {assigneeType !== 'identity.user' && (
          <label className="field">
            <span>Custodian (Employee responsible)</span>
            <select value={custodianUserId} onChange={(e) => setCustodianUserId(e.target.value)}>
              <option value="">None / Unassigned</option>
              {(users.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Condition Out</span>
          <select value={conditionOut} onChange={(e) => setConditionOut(e.target.value)}>
            <option value="New">Brand New</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Poor">Poor / Minor defects</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Handover Note</span>
        <textarea
          rows={2}
          placeholder="e.g., Given for engineering work at Hyderabad branch"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Confirm Assignment</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function TransferForm({ orgId, asset, busy, run, onCancel }) {
  const users = useLookup(['users', orgId, 'active'], ({ signal }) =>
    usersApi.list(orgId, { limit: 100, status: 'active' }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )
  const units = useLookup(['org-units', orgId, 'all'], ({ signal }) =>
    orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const [toType, setToType] = useState('identity.user')
  const [toId, setToId] = useState('')
  const [toCustodianId, setToCustodianId] = useState('')
  const [condition, setCondition] = useState('Good')
  const [note, setNote] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!toId) return
    run(() =>
      assetsApi.transfer(orgId, asset, {
        to_assignee_type: toType,
        to_assignee_id: toId,
        to_custodian_user_id: toCustodianId || undefined,
        condition_transfer: condition,
        note: note || undefined,
      })
    )
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Transfer Custody: {asset.asset_tag}</h3>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Transfer To</span>
          <select value={toType} onChange={(e) => { setToType(e.target.value); setToId('') }}>
            {Object.entries(ASSIGNEE_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>New Assignee</span>
          {toType === 'identity.user' ? (
            <select required value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Select Employee…</option>
              {(users.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          ) : (
            <select required value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Select Department / Branch…</option>
              {(units.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
        </label>

        {toType !== 'identity.user' && (
          <label className="field">
            <span>New Custodian User</span>
            <select value={toCustodianId} onChange={(e) => setToCustodianId(e.target.value)}>
              <option value="">None</option>
              {(users.data || []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Condition during transfer</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Damaged">Damaged / Needs Inspection</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Reason / Notes for Transfer</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Complete Transfer</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function ReturnForm({ orgId, asset, busy, run, onCancel }) {
  const [conditionIn, setConditionIn] = useState('Good')
  const [note, setNote] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    run(() =>
      assetsApi.return(orgId, asset, {
        condition_in: conditionIn,
        note: note || undefined,
      })
    )
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Return {asset.asset_tag} to Stock</h3>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Condition upon return</span>
          <select value={conditionIn} onChange={(e) => setConditionIn(e.target.value)}>
            <option value="Good">Good / Working</option>
            <option value="Fair">Fair / Minor wear</option>
            <option value="Damaged">Damaged / Needs repair</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Return Notes</span>
        <textarea rows={2} placeholder="Checklist completed, all accessories received" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Confirm Return to Stock</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function MaintenanceForm({ orgId, asset, busy, run, onCancel }) {
  const vendors = useLookup(['vendors', orgId], ({ signal }) =>
    assetMasterApi.vendors(orgId, {}, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const [type, setType] = useState('preventive')
  const [vendorId, setVendorId] = useState('')
  const [scheduledOn, setScheduledOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    run(() =>
      assetsApi.scheduleMaintenance(orgId, asset.id, {
        maintenance_type: type,
        vendor_id: vendorId || undefined,
        scheduled_on: scheduledOn,
        cost: amount ? { amount: parseFloat(amount), currency: 'INR' } : undefined,
        notes: notes || undefined,
      })
    )
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Schedule Maintenance for {asset.asset_tag}</h3>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Maintenance Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(MAINTENANCE_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Scheduled Date</span>
          <input type="date" required value={scheduledOn} onChange={(e) => setScheduledOn(e.target.value)} />
        </label>

        <label className="field">
          <span>Vendor / Service Provider (Optional)</span>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">In-House / None</option>
            {(vendors.data || []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Estimated Cost (INR)</span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Notes / Scope of Work</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Schedule Maintenance</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function DisposeForm({ orgId, asset, busy, run, onCancel }) {
  const [method, setMethod] = useState('scrapped')
  const [disposedOn, setDisposedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [realised, setRealised] = useState('')
  const [dataWiped, setDataWiped] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    run(() =>
      assetsApi.dispose(orgId, asset, {
        method,
        disposed_on: disposedOn,
        value_realised: realised ? { amount: parseFloat(realised), currency: 'INR' } : undefined,
        data_wiped: dataWiped,
      })
    )
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Decommission & Dispose: {asset.asset_tag}</h3>
      <div className="alert warning">
        Disposing an asset marks it permanently retired and removes it from active inventory or assignment.
      </div>
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label className="field">
          <span>Disposal Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(DISPOSAL_METHOD_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Disposal Date</span>
          <input type="date" required value={disposedOn} onChange={(e) => setDisposedOn(e.target.value)} />
        </label>

        <label className="field">
          <span>Salvage / Realised Value (INR)</span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={realised}
            onChange={(e) => setRealised(e.target.value)}
          />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={dataWiped}
          onChange={(e) => setDataWiped(e.target.checked)}
        />
        <span>
          <strong>Data sanitization / wiping verified:</strong> All disks, caches, credentials, and company data have been securely wiped.
        </span>
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" style={{ background: '#b91c1c', borderColor: '#b91c1c' }} disabled={busy} aria-busy={busy}>
          Confirm Decommissioning
        </button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function RevealSecretForm({ orgId, asset, busy, onCancel, onRevealed }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const secret = await assetsApi.revealCredential(orgId, asset.id, { reason: reason.trim() })
      onRevealed(secret)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Reveal Credential: {asset.name}</h3>
      <ErrorBanner error={error} />
      <p className="muted small">
        For audit and security compliance, credential accesses are logged in the organization security log.
      </p>
      <label className="field">
        <span>Reason for credential access</span>
        <input
          type="text"
          required
          placeholder="e.g., Rotating server root certificate / emergency outage access"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy || submitting} aria-busy={busy || submitting}>
          Decrypt & Reveal
        </button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
