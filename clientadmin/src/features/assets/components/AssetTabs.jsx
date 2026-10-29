import { useState } from 'react'
import { assetsApi } from '@/features/assets/api.js'
import {
  COST_TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  MAINTENANCE_TYPE_LABELS,
  RELATION_TYPE_LABELS,
  resolveAssignee,
  resolveUnitName,
  resolveUserName,
} from '@/features/assets/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { usersApi } from '@/features/users/api.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// ---------- Tab 1: Overview ----------
export function AssetOverview({ orgId, asset }) {
  const users = useLookup(
    ['users', orgId, 'all'],
    ({ signal }) => usersApi.list(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )
  const units = useLookup(
    ['org-units', orgId, 'all'],
    ({ signal }) => orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const custodyRes = asset.custody ? resolveAssignee(asset.custody, users.data, units.data) : null
  const custodianName = resolveUserName(asset.custodian_user_id || asset.custodian?.id, users.data)
  const ownerUnitName = resolveUnitName(asset.owner_unit_id || asset.owner_unit?.id, units.data)

  return (
    <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
      <Detail label="Asset Tag">
        <span className="mono" style={{ fontWeight: 600 }}>{asset.asset_tag}</span>
      </Detail>
      <Detail label="Asset Name">{asset.name}</Detail>
      <Detail label="Asset Type">
        {asset.type?.name} <span className="muted small">({asset.type?.code})</span>
      </Detail>
      <Detail label="Type Family">
        <span style={{ textTransform: 'capitalize' }}>{asset.type?.family}</span>
      </Detail>
      <Detail label="Current Custody">
        {asset.custody ? (
          <div>
            <strong style={{ fontSize: 14 }}>{custodyRes?.name}</strong>
            {custodyRes?.subtext && <div className="muted small">{custodyRes.subtext}</div>}
            <div className="muted small">{custodyRes?.typeLabel}</div>
          </div>
        ) : (
          <span className="muted">In Stock / Unassigned</span>
        )}
      </Detail>
      <Detail label="Designated Custodian (Human)">
        {custodianName || asset.custodian?.name || <span className="muted">—</span>}
      </Detail>
      <Detail label="Owning Department / Unit">
        {ownerUnitName || (asset.owner_unit?.name ? `${asset.owner_unit.name} (${asset.owner_unit.unit_type || ''})` : <span className="muted">—</span>)}
      </Detail>
      <Detail label="Location Details">
        {asset.location_details || <span className="muted">—</span>}
      </Detail>
      <Detail label="Serial Number">
        {asset.serial_no ? <span className="mono">{asset.serial_no}</span> : <span className="muted">—</span>}
      </Detail>
      <Detail label="Acquired On">{formatDate(asset.acquired_on)}</Detail>
      <Detail label="Acquisition Cost">{formatMoney(asset.acquisition_cost)}</Detail>
      <Detail label="Warranty / Expiry Date">{formatDate(asset.expires_at)}</Detail>
      <Detail label="Auto-Renew">
        {asset.auto_renew ? (
          <span className="badge active">Auto-Renew Enabled</span>
        ) : (
          <span className="muted">Manual Renewal</span>
        )}
      </Detail>
      <Detail label="Vendor Account">
        {asset.vendor_account ? (
          <div>
            <div>{asset.vendor_account.vendor}</div>
            <div className="muted small mono">{asset.vendor_account.account}</div>
          </div>
        ) : (
          <span className="muted">—</span>
        )}
      </Detail>

      {asset.attributes && Object.keys(asset.attributes).length > 0 && (
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 12px' }}>Custom Specifications & Attributes</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {Object.entries(asset.attributes).map(([key, val]) => (
              <Detail key={key} label={key.replace(/_/g, ' ')}>
                {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
              </Detail>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Tab 2: Custody History ----------
export function AssetCustodyHistory({ orgId, assetId }) {
  const { data, loading, error, reload } = useQuery(
    ['asset-history', orgId, assetId],
    ({ signal }) => assetsApi.history(orgId, assetId, { signal }),
    { enabled: Boolean(orgId && assetId) }
  )
  const users = useLookup(
    ['users', orgId, 'all'],
    ({ signal }) => usersApi.list(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )
  const units = useLookup(
    ['org-units', orgId, 'all'],
    ({ signal }) => orgUnitsApi.listAll(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const records = data || []

  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0 }}>Custody & Handover Audit Trail</h3>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Complete chain of custody records for ISO 27001, SOC 2, and physical audit compliance.
        </p>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <table>
        <thead>
          <tr>
            <th>Assignee</th>
            <th>Type</th>
            <th>Assigned At</th>
            <th>Returned At</th>
            <th>Condition Out</th>
            <th>Condition In</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeleton cols={6} />
          ) : records.length === 0 ? (
            <tr><td colSpan={6} className="center-note">No custody assignment history on file.</td></tr>
          ) : (
            records.map((r) => {
              const res = resolveAssignee(r.assignee, users.data, units.data)
              const custodianName = resolveUserName(r.custodian_user_id, users.data)
              return (
                <tr key={r.id}>
                  <td>
                    <div>
                      <strong style={{ fontSize: 14 }}>{res.name}</strong>
                      {res.subtext && <div className="muted small">{res.subtext}</div>}
                    </div>
                    {custodianName && custodianName !== res.name && (
                      <div className="muted small" style={{ marginTop: 2 }}>
                        Custodian: {custodianName}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge draft" style={{ fontSize: 12 }}>
                      {res.typeLabel}
                    </span>
                  </td>
                  <td>{formatDateTime(r.assigned_at)}</td>
                  <td>{r.returned_at ? formatDateTime(r.returned_at) : <span className="badge active">Currently Held</span>}</td>
                  <td>{r.condition_out || <span className="muted">—</span>}</td>
                  <td>{r.condition_in || <span className="muted">—</span>}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Tab 3: Maintenance Records ----------
export function AssetMaintenance({ orgId, assetId, onAssetChanged }) {
  const { user: me } = useAuth()
  const canMaintain = hasAccess(me, ACCESS.maintainAssets)
  const [completeRecordId, setCompleteRecordId] = useState(null)
  const [completedOn, setCompletedOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [costAmount, setCostAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const { data, loading, error, reload } = useQuery(
    ['asset-maintenance', orgId, assetId],
    ({ signal }) => assetsApi.listMaintenance(orgId, assetId, { signal }),
    { enabled: Boolean(orgId && assetId) }
  )

  const records = data || []

  const handleComplete = async (e) => {
    e.preventDefault()
    if (!completeRecordId) return
    setBusy(true)
    setSubmitError(null)
    try {
      await assetsApi.completeMaintenance(orgId, assetId, completeRecordId, {
        completed_on: completedOn,
        cost: costAmount ? { amount: parseFloat(costAmount), currency: 'INR' } : undefined,
        notes: notes || undefined,
      })
      setCompleteRecordId(null)
      reload()
      invalidate(['assets', orgId])
      invalidate(['asset', orgId, assetId])
      if (onAssetChanged) onAssetChanged()
    } catch (err) {
      setSubmitError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <ErrorBanner error={submitError || error} onRetry={reload} />

      {completeRecordId && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleComplete}>
          <h3 style={{ marginTop: 0 }}>Mark Maintenance Completed</h3>
          <p className="muted small">
            Completing maintenance returns the asset back to “In Stock” and logs the actual repair cost.
          </p>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label className="field">
              <span>Completed Date</span>
              <input type="date" required value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
            </label>
            <label className="field">
              <span>Final Incurred Cost (INR)</span>
              <input type="number" step="0.01" placeholder="0.00" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Completion Notes & Work Performed</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} aria-busy={busy}>Complete & Return to Stock</button>
            <button type="button" className="btn secondary" onClick={() => setCompleteRecordId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Scheduled On</th>
              <th>Status</th>
              <th>Completed On</th>
              <th>Cost</th>
              <th>Notes</th>
              {canMaintain && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canMaintain ? 7 : 6} />
            ) : records.length === 0 ? (
              <tr><td colSpan={canMaintain ? 7 : 6} className="center-note">No maintenance records logged.</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{MAINTENANCE_TYPE_LABELS[r.maintenance_type] || r.maintenance_type}</strong></td>
                  <td>{formatDate(r.scheduled_on)}</td>
                  <td>
                    {r.completed_on ? (
                      <span className="badge done">Completed</span>
                    ) : (
                      <span className="badge amber">Pending</span>
                    )}
                  </td>
                  <td>{r.completed_on ? formatDate(r.completed_on) : <span className="muted">—</span>}</td>
                  <td>{formatMoney(r.cost)}</td>
                  <td>{r.notes || <span className="muted">—</span>}</td>
                  {canMaintain && (
                    <td style={{ textAlign: 'right' }}>
                      {!r.completed_on && (
                        <button className="btn secondary small" onClick={() => setCompleteRecordId(r.id)}>
                          Complete…
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab 4: Renewals ----------
export function AssetRenewals({ orgId, assetId, onAssetChanged }) {
  const { user: me } = useAuth()
  const canWrite = hasAccess(me, ACCESS.manageAssets)
  const [showAddForm, setShowAddForm] = useState(false)
  const [dueOn, setDueOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [renewalNotes, setRenewalNotes] = useState('')
  const [decidingId, setDecidingId] = useState(null)
  const [decision, setDecision] = useState('approved')
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const { data, loading, error, reload } = useQuery(
    ['asset-renewals', orgId, assetId],
    ({ signal }) => assetsApi.listRenewals(orgId, assetId, { signal }),
    { enabled: Boolean(orgId && assetId) }
  )

  const records = data || []

  const handleCreateRenewal = async (e) => {
    e.preventDefault()
    setBusy(true)
    setActionError(null)
    try {
      await assetsApi.createRenewal(orgId, assetId, {
        due_on: dueOn,
        notes: renewalNotes || undefined,
      })
      setShowAddForm(false)
      reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleDecide = async (e) => {
    e.preventDefault()
    if (!decidingId) return
    setBusy(true)
    setActionError(null)
    try {
      await assetsApi.decideRenewal(orgId, assetId, decidingId, {
        status: decision,
        new_expires_at: decision === 'approved' && newExpiresAt ? newExpiresAt : undefined,
      })
      setDecidingId(null)
      reload()
      invalidate(['assets', orgId])
      invalidate(['asset', orgId, assetId])
      if (onAssetChanged) onAssetChanged()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="row-actions" style={{ marginBottom: 12 }}>
        {canWrite && !showAddForm && (
          <button className="btn" onClick={() => setShowAddForm(true)}>+ Schedule Renewal Review</button>
        )}
      </div>

      <ErrorBanner error={actionError || error} onRetry={reload} />

      {showAddForm && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleCreateRenewal}>
          <h3 style={{ marginTop: 0 }}>Schedule Renewal Review</h3>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label className="field">
              <span>Renewal Due Date</span>
              <input type="date" required value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Notes / Justification</span>
            <textarea rows={2} value={renewalNotes} onChange={(e) => setRenewalNotes(e.target.value)} />
          </label>
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} aria-busy={busy}>Schedule</button>
            <button type="button" className="btn secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {decidingId && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleDecide}>
          <h3 style={{ marginTop: 0 }}>Decide Contract / Warranty Renewal</h3>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label className="field">
              <span>Decision</span>
              <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                <option value="approved">Approve Renewal</option>
                <option value="rejected">Reject / Do Not Renew</option>
              </select>
            </label>
            {decision === 'approved' && (
              <label className="field">
                <span>New Expiration Date</span>
                <input type="date" required value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} />
              </label>
            )}
          </div>
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} aria-busy={busy}>Save Decision</button>
            <button type="button" className="btn secondary" onClick={() => setDecidingId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Due Date</th>
              <th>Status</th>
              <th>Extended Expiry</th>
              <th>Decided By</th>
              {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canWrite ? 5 : 4} />
            ) : records.length === 0 ? (
              <tr><td colSpan={canWrite ? 5 : 4} className="center-note">No renewal trackers logged.</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td><strong>{formatDate(r.due_on)}</strong></td>
                  <td>
                    {r.status === 'approved' && <span className="badge done">Approved</span>}
                    {r.status === 'rejected' && <span className="badge expired">Rejected</span>}
                    {r.status === 'pending' && <span className="badge amber">Pending Review</span>}
                  </td>
                  <td>{r.new_expires_at ? formatDate(r.new_expires_at) : <span className="muted">—</span>}</td>
                  <td>{r.decided_by ? <span className="mono small">{r.decided_by}</span> : <span className="muted">—</span>}</td>
                  {canWrite && (
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'pending' && (
                        <button className="btn secondary small" onClick={() => setDecidingId(r.id)}>
                          Decide…
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab 5: Costs & Total Cost of Ownership (TCO) ----------
export function AssetCosts({ orgId, assetId }) {
  const { user: me } = useAuth()
  const canWrite = hasAccess(me, ACCESS.manageAssets)
  const [showAdd, setShowAdd] = useState(false)
  const [costType, setCostType] = useState('maintenance')
  const [amount, setAmount] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const { data, loading, error, reload } = useQuery(
    ['asset-costs', orgId, assetId],
    ({ signal }) => assetsApi.getCosts(orgId, assetId, { signal }),
    { enabled: Boolean(orgId && assetId) }
  )

  const [ledger, summary] = Array.isArray(data) ? data : [[], { total_cost: { amount: 0, currency: 'INR' }, costs_by_type: {} }]

  const handleAddCost = async (e) => {
    e.preventDefault()
    if (!amount) return
    setBusy(true)
    setSubmitError(null)
    try {
      await assetsApi.addCost(orgId, assetId, {
        cost_type: costType,
        amount: parseFloat(amount),
        currency: 'INR',
        vendor_invoice_ref: invoiceRef || undefined,
      })
      setShowAdd(false)
      setAmount('')
      setInvoiceRef('')
      reload()
    } catch (err) {
      setSubmitError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="panel" style={{ background: '#f8fafc' }}>
          <div className="detail-label">Total Cost of Ownership (TCO)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {formatMoney(summary?.total_cost)}
          </div>
        </div>
        {summary?.costs_by_type &&
          Object.entries(summary.costs_by_type).map(([k, amt]) => (
            <div key={k} className="panel">
              <div className="detail-label">{COST_TYPE_LABELS[k] || k}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                {formatMoney({ amount: amt, currency: 'INR' })}
              </div>
            </div>
          ))}
      </div>

      <div className="row-actions" style={{ marginBottom: 12 }}>
        {canWrite && !showAdd && (
          <button className="btn" onClick={() => setShowAdd(true)}>+ Add Cost Entry</button>
        )}
      </div>

      <ErrorBanner error={submitError || error} onRetry={reload} />

      {showAdd && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleAddCost}>
          <h3 style={{ marginTop: 0 }}>Add Ledger Cost</h3>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label className="field">
              <span>Cost Type</span>
              <select value={costType} onChange={(e) => setCostType(e.target.value)}>
                {Object.entries(COST_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Amount (INR)</span>
              <input type="number" step="0.01" required placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              <span>Vendor Invoice / Reference</span>
              <input type="text" placeholder="INV-2026-001" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
            </label>
          </div>
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} aria-busy={busy}>Save Cost</button>
            <button type="button" className="btn secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Cost Type</th>
              <th>Amount</th>
              <th>Invoice Reference</th>
              <th>Billing Period</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={4} />
            ) : (!ledger || ledger.length === 0) ? (
              <tr><td colSpan={4} className="center-note">No additional cost entries recorded.</td></tr>
            ) : (
              ledger.map((c) => (
                <tr key={c.id}>
                  <td><strong>{COST_TYPE_LABELS[c.cost_type] || c.cost_type}</strong></td>
                  <td><strong>{formatMoney(c.amount)}</strong></td>
                  <td>{c.vendor_invoice_ref || <span className="muted">—</span>}</td>
                  <td>
                    {c.period_start || c.period_end ? (
                      `${formatDate(c.period_start)} → ${formatDate(c.period_end)}`
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab 6: Topology & Relationships ----------
export function AssetRelationships({ orgId, assetId }) {
  const { user: me } = useAuth()
  const canWrite = hasAccess(me, ACCESS.manageAssets)
  const [showAdd, setShowAdd] = useState(false)
  const [relType, setRelType] = useState('parent_of')
  const [targetAssetId, setTargetAssetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const otherAssets = useLookup(
    ['other-assets', orgId],
    ({ signal }) => assetsApi.list(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  const { data, loading, error, reload } = useQuery(
    ['asset-relationships', orgId, assetId],
    ({ signal }) => assetsApi.listRelationships(orgId, assetId, { signal }),
    { enabled: Boolean(orgId && assetId) }
  )

  const relationships = data || []

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!targetAssetId) return
    setBusy(true)
    setSubmitError(null)
    try {
      await assetsApi.createRelationship(orgId, assetId, {
        relation_type: relType,
        related_asset_id: targetAssetId,
      })
      setShowAdd(false)
      setTargetAssetId('')
      reload()
    } catch (err) {
      setSubmitError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="row-actions" style={{ marginBottom: 12 }}>
        {canWrite && !showAdd && (
          <button className="btn" onClick={() => setShowAdd(true)}>+ Link Related Asset</button>
        )}
      </div>

      <ErrorBanner error={submitError || error} onRetry={reload} />

      {showAdd && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleAdd}>
          <h3 style={{ marginTop: 0 }}>Link Related Asset</h3>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <label className="field">
              <span>Relationship Type</span>
              <select value={relType} onChange={(e) => setRelType(e.target.value)}>
                {Object.entries(RELATION_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Target Asset</span>
              <select required value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}>
                <option value="">Choose asset…</option>
                {(otherAssets.data || [])
                  .filter((a) => a.id !== assetId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_tag} — {a.name} ({a.type?.name})
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn" disabled={busy} aria-busy={busy}>Create Link</button>
            <button type="button" className="btn secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Relationship</th>
              <th>Related Asset ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={2} />
            ) : relationships.length === 0 ? (
              <tr><td colSpan={2} className="center-note">No linked hardware, software or component dependencies.</td></tr>
            ) : (
              relationships.map((r) => {
                const target = (otherAssets.data || []).find((a) => a.id === r.related_asset_id)
                return (
                  <tr key={r.id}>
                    <td><strong>{RELATION_TYPE_LABELS[r.relation_type] || r.relation_type}</strong></td>
                    <td>
                      {target ? (
                        <div>
                          <span className="mono" style={{ fontWeight: 600 }}>{target.asset_tag}</span> — {target.name}
                        </div>
                      ) : (
                        <span className="mono">{r.related_asset_id}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
