import { useState, useEffect } from 'react'
import { assetMasterApi } from '@/features/assets/api.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const ASSET_FAMILIES = [
  { value: 'hardware', label: 'Hardware (laptops, phones, servers, equipment)' },
  { value: 'software', label: 'Software (licenses, SaaS subscriptions, cloud seats)' },
  { value: 'facility', label: 'Facility (furniture, tools, office appliances)' },
  { value: 'credential', label: 'Credential (API keys, root passwords, access tokens)' },
  { value: 'vehicle', label: 'Vehicle (fleet cars, bikes, delivery vans)' },
]

export default function CreateAssetTypeModal({ orgId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [family, setFamily] = useState('hardware')
  const [tracksExpiry, setTracksExpiry] = useState(false)
  const [singleCustodian, setSingleCustodian] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const categories = useLookup(
    ['asset-categories', orgId],
    ({ signal }) => assetMasterApi.categories(orgId, { limit: 100 }, { signal }).then((r) => r.data || []),
    { enabled: Boolean(orgId) }
  )

  useEffect(() => {
    if (!categoryId && categories.data && categories.data.length > 0) {
      setCategoryId(categories.data[0].id)
    }
  }, [categories.data, categoryId])

  const handleNameChange = (val) => {
    setName(val)
    if (!codeManuallyEdited) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      setCode(slug)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !categoryId) return

    setBusy(true)
    setError(null)
    try {
      const res = await assetMasterApi.createType(orgId, {
        category_id: categoryId,
        code: code.trim().toLowerCase(),
        name: name.trim(),
        family,
        tracks_expiry: tracksExpiry,
        single_custodian: singleCustodian,
      })
      invalidate(['asset-types', orgId])
      onCreated?.(res)
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Add New Asset Type" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <ErrorBanner error={error} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field">
            <span>Category *</span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={categories.isLoading || busy}
            >
              <option value="">Select category…</option>
              {(categories.data || []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Asset Type Name *</span>
            <input
              type="text"
              required
              placeholder="e.g. Drone, Electric Vehicle, SSL Certificate"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={busy}
            />
          </label>

          <label className="field">
            <span>Type Code * (unique slug identifier)</span>
            <input
              type="text"
              required
              placeholder="e.g. drone, electric_vehicle, ssl_certificate"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setCodeManuallyEdited(true)
              }}
              disabled={busy}
            />
          </label>

          <label className="field">
            <span>Asset Family *</span>
            <select
              value={family}
              onChange={(e) => {
                const fam = e.target.value
                setFamily(fam)
                if (fam === 'software' || fam === 'credential') {
                  setTracksExpiry(true)
                }
              }}
              disabled={busy}
            >
              {ASSET_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={tracksExpiry}
                onChange={(e) => setTracksExpiry(e.target.checked)}
                disabled={busy}
              />
              <span>Tracks expiry or warranty / renewal deadline</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={singleCustodian}
                onChange={(e) => setSingleCustodian(e.target.checked)}
                disabled={busy}
              />
              <span>Single custodian (assigned to one person or department at a time)</span>
            </label>
          </div>
        </div>

        <div className="dialog-foot" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy || !name.trim() || !code.trim() || !categoryId}>
            {busy ? 'Creating…' : 'Create Asset Type'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
