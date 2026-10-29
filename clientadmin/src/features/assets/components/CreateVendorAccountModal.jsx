import { useState, useEffect } from 'react'
import { assetMasterApi } from '@/features/assets/api.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const VENDOR_TYPES = [
  { value: 'supplier', label: 'Supplier / Hardware OEM (e.g. Dell, Apple, Lenovo)' },
  { value: 'saas', label: 'SaaS / Cloud Provider (e.g. AWS, Microsoft, Google)' },
  { value: 'telecom', label: 'ISP / Telecom (e.g. Airtel, Jio, Cisco)' },
  { value: 'maintenance', label: 'Maintenance / Servicing Contractor' },
  { value: 'contractor', label: 'General Contractor' },
]

export default function CreateVendorAccountModal({ orgId, onClose, onCreated }) {
  const [vendorId, setVendorId] = useState('')
  const [accountIdentifier, setAccountIdentifier] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Inline New Vendor creation state
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorType, setNewVendorType] = useState('supplier')
  const [creatingVendor, setCreatingVendor] = useState(false)
  const [vendorError, setVendorError] = useState(null)

  const vendors = useLookup(
    ['vendors', orgId],
    ({ signal }) => assetMasterApi.vendors(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  useEffect(() => {
    if (!vendorId && vendors.data && vendors.data.length > 0) {
      setVendorId(vendors.data[0].id)
    }
  }, [vendors.data, vendorId])

  const handleCreateVendor = async (e) => {
    e.preventDefault()
    if (!newVendorName.trim()) return

    setCreatingVendor(true)
    setVendorError(null)
    try {
      const created = await assetMasterApi.createVendor(orgId, {
        name: newVendorName.trim(),
        vendor_type: newVendorType,
      })
      await invalidate(['vendors', orgId])
      setVendorId(created.id)
      setNewVendorName('')
      setShowAddVendor(false)
    } catch (err) {
      setVendorError(err)
    } finally {
      setCreatingVendor(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!vendorId || !accountIdentifier.trim()) return

    setBusy(true)
    setError(null)
    try {
      const res = await assetMasterApi.createVendorAccount(orgId, {
        vendor_id: vendorId,
        account_identifier: accountIdentifier.trim(),
        billing_email: billingEmail.trim() || undefined,
      })
      await invalidate(['vendor-accounts', orgId])
      onCreated?.(res)
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Add Vendor Account" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <ErrorBanner error={error} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Vendor selection & inline creation */}
          <div className="field">
            <span>Supplier / Vendor *</span>
            <div className="field-action-group">
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={vendors.isLoading || busy}
              >
                <option value="">Select vendor…</option>
                {(vendors.data || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendor_type})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setShowAddVendor(!showAddVendor)
                  setVendorError(null)
                }}
              >
                {showAddVendor ? 'Close' : '+ New Vendor'}
              </button>
            </div>

            {showAddVendor && (
              <div style={{ marginTop: 10, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Add New Supplier / Vendor</div>
                <ErrorBanner error={vendorError} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Vendor Name (e.g. Dell, Apple, Amazon Web Services)"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    disabled={creatingVendor}
                  />
                  <div className="field-action-group">
                    <select
                      value={newVendorType}
                      onChange={(e) => setNewVendorType(e.target.value)}
                      disabled={creatingVendor}
                    >
                      {VENDOR_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleCreateVendor}
                      disabled={creatingVendor || !newVendorName.trim()}
                    >
                      {creatingVendor ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <label className="field">
            <span>Account Identifier *</span>
            <input
              type="text"
              required
              placeholder="e.g. Dell Business Direct (Cust #4928), AWS Master (Acct 12345)"
              value={accountIdentifier}
              onChange={(e) => setAccountIdentifier(e.target.value)}
              disabled={busy}
            />
          </label>

          <label className="field">
            <span>Billing Email (Optional)</span>
            <input
              type="email"
              placeholder="e.g. billing@company.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <div className="dialog-foot" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn"
            disabled={busy || !vendorId || !accountIdentifier.trim()}
          >
            {busy ? 'Saving…' : 'Add Vendor Account'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
