import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { customersApi } from '@/features/customers/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { useRecordForm } from '@/shared/utils/useRecordForm.js'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import CustomerContacts from '@/features/customers/components/CustomerContacts.jsx'
import CustomerFields from '@/features/customers/components/CustomerFields.jsx'
import CustomerServices from '@/features/customers/components/CustomerServices.jsx'
import { CUSTOMER_TYPES, addressFromForm, addressToForm, formatAddress } from '@/features/customers/utils.js'
import useOwners from '@/features/customers/useOwners.js'

const toForm = (c) => ({
  name: c.name || '',
  legal_name: c.legal_name || '',
  gstin: c.gstin || '',
  owner_user_id: c.owner?.id || '',
  status: c.status,
  address: addressToForm(c.billing_address),
})

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { owners, ownerName } = useOwners(orgId)
  const canManage = hasAccess(me, ACCESS.manageCustomers)
  const canSeeServices = hasAccess(me, ACCESS.clientServices)

  const tabs = [
    ['overview', 'Overview'],
    ['contacts', 'Contacts'],
    ...(canSeeServices ? [['services', 'Services']] : []),
  ]
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'

  const {
    data: customer,
    error: loadError,
    loading,
    reload,
    setData,
  } = useQuery(['customer', orgId, id], ({ signal }) => customersApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const setCustomer = (next) => {
    setData(next)
    invalidate(['customers', orgId])
  }
  const { form, setForm, base, rebase } = useRecordForm(customer, toForm)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  if (error?.code === 'GSTIN_INVALID' || error?.code === 'DUPLICATE_CLIENT') fieldErrors.gstin = friendlyMessage(error)

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }
  const setAddress = (k, v) => {
    setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      // Send only what changed. The backend ignores blanks, so a GSTIN can be changed but not removed.
      const original = toForm(base) // what the form was taken from, not a newer refresh
      const body = {}
      for (const k of ['name', 'legal_name', 'gstin']) {
        if (form[k].trim() && form[k].trim() !== original[k]) body[k] = form[k].trim()
      }
      if (form.owner_user_id !== original.owner_user_id) body.owner_user_id = form.owner_user_id
      if (form.status !== original.status) body.status = form.status
      const address = addressFromForm(form.address)
      if (JSON.stringify(address) !== JSON.stringify(addressFromForm(original.address))) body.billing_address = address

      if (Object.keys(body).length) {
        const updated = await customersApi.update(orgId, id, base.version, body)
        setCustomer(updated)
        rebase(updated)
      }
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading || (customer && !form)) return <DetailSkeleton />
  if (!customer)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/customers')}>← Back</button>
      </div>
    )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {customer.name} <StatusBadge status={customer.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{customer.code}</span>
            {activeOrg && ` · ${activeOrg.name}`}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/customers')}>← Back</button>
      </div>

      <div className="version-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })}
          >
            {label}
            {key === 'contacts' && customer.contacts?.length > 0 && <span className="muted small">{customer.contacts.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="panel">
            <div className="details-grid">
              <Detail label="Legal name">{customer.legal_name}</Detail>
              <Detail label="Type">{CUSTOMER_TYPES[customer.client_type] || customer.client_type}</Detail>
              <Detail label="GSTIN"><span className="mono">{customer.gstin}</span></Detail>
              <Detail label="PAN"><span className="mono">{customer.pan}</span></Detail>
              <Detail label="Owner">{ownerName(customer.owner.id)}</Detail>
              <Detail label="Source">{customer.source}</Detail>
              <Detail label="Added">{formatDate(customer.created_at.slice(0, 10))}</Detail>
              <Detail label="Billing address">{formatAddress(customer.billing_address)}</Detail>
            </div>
          </div>

          {canManage && (
            <>
              {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
              {saved && <div className="alert success">Saved.</div>}
              <form className="panel" onSubmit={handleSave}>
                <h2 style={{ marginTop: 0, fontSize: 17 }}>Edit customer</h2>
                <CustomerFields
                  form={form}
                  set={set}
                  setAddress={setAddress}
                  fieldErrors={fieldErrors}
                  owners={owners}
                  me={me}
                  isCreate={false}
                />
                <div className="row-actions" style={{ marginTop: 8 }}>
                  <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </form>
            </>
          )}
        </>
      )}

      {tab === 'contacts' && <CustomerContacts orgId={orgId} customer={customer} canManage={canManage} onAdded={reload} />}

      {tab === 'services' && (
        <CustomerServices
          orgId={orgId}
          customerId={customer.id}
          canManage={hasAccess(me, ACCESS.manageClientServices)}
          defaultCurrency={activeOrg?.base_currency || 'INR'}
        />
      )}
    </div>
  )
}
