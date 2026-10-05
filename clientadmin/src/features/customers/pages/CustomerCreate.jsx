import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi } from '@/features/customers/api.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import CustomerFields from '@/features/customers/components/CustomerFields.jsx'
import { EMPTY_ADDRESS, addressFromForm } from '@/features/customers/utils.js'
import useOwners from '@/features/customers/useOwners.js'

export default function CustomerCreate() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { owners } = useOwners(orgId)
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    client_type: 'company',
    gstin: '',
    pan: '',
    owner_user_id: me?.id || '',
    source: '',
    address: EMPTY_ADDRESS,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fieldErrors = getFieldErrors(error)
  if (error?.code === 'GSTIN_INVALID' || error?.code === 'DUPLICATE_CLIENT') fieldErrors.gstin = friendlyMessage(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setAddress = (k, v) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        name: form.name.trim(),
        legal_name: form.legal_name.trim(),
        client_type: form.client_type,
        owner_user_id: form.owner_user_id,
        billing_address: addressFromForm(form.address),
      }
      for (const k of ['gstin', 'pan', 'source']) if (form[k].trim()) body[k] = form[k].trim()
      const created = await customersApi.create(orgId, body)
      navigate(`/customers/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New customer</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate('/customers')}>Cancel</button>
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <form className="panel" onSubmit={handleSubmit}>
        <CustomerFields
          form={form}
          set={set}
          setAddress={setAddress}
          fieldErrors={fieldErrors}
          owners={owners}
          me={me}
          isCreate
        />
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button className="btn" type="submit" disabled={submitting || !orgId}>
            {submitting ? 'Creating…' : 'Create customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
