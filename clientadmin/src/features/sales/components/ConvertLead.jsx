import { useEffect, useState } from 'react'
import { leadsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { customersApi } from '@/features/customers/api.js'
import CustomerFields from '@/features/customers/components/CustomerFields.jsx'
import { EMPTY_ADDRESS, addressFromForm } from '@/features/customers/utils.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { toIsoDate } from '@/shared/utils/dates.js'

function inDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

// Turns a lead into an opportunity for a customer: an existing one, or a new prospect
// (who becomes an active customer once they accept a quotation).
export default function ConvertLead({ orgId, lead, owners, defaultCurrency, onConverted, onCancel }) {
  const { user: me } = useAuth()
  const canPickExisting = hasAccess(me, ACCESS.customers)
  const canCreate = hasAccess(me, ACCESS.manageCustomers)
  const displayName = lead.company_name || lead.contact_name

  const [mode, setMode] = useState(canCreate ? 'new' : 'existing')
  const [customers, setCustomers] = useState([])
  const [existingId, setExistingId] = useState('')
  const [customer, setCustomer] = useState({
    name: displayName,
    legal_name: displayName,
    client_type: lead.company_name ? 'company' : 'individual',
    gstin: '',
    pan: '',
    owner_user_id: lead.owner?.id || me?.id || '',
    source: lead.source || '',
    address: EMPTY_ADDRESS,
  })
  const [opportunity, setOpportunity] = useState({
    name: `${displayName} — new business`,
    amount: '',
    currency: defaultCurrency,
    expected_close_date: inDays(30),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  if (error?.code === 'GSTIN_INVALID' || error?.code === 'DUPLICATE_CLIENT') fieldErrors.gstin = friendlyMessage(error)

  useEffect(() => {
    if (!canPickExisting) return
    customersApi.listAll(orgId).then(setCustomers).catch(() => setCustomers([]))
  }, [orgId, canPickExisting])

  const setCustomerField = (k, v) => setCustomer((c) => ({ ...c, [k]: v }))
  const setAddress = (k, v) => setCustomer((c) => ({ ...c, address: { ...c.address, [k]: v } }))
  const setOpp = (k, v) => setOpportunity((o) => ({ ...o, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        opportunity: {
          name: opportunity.name.trim(),
          expected_value: { amount: Number(opportunity.amount), currency: opportunity.currency.trim().toUpperCase() },
          expected_close_date: opportunity.expected_close_date,
        },
      }
      if (mode === 'existing') {
        body.existing_client_id = existingId
      } else {
        body.new_client = {
          name: customer.name.trim(),
          legal_name: customer.legal_name.trim(),
          client_type: customer.client_type,
          owner_user_id: customer.owner_user_id,
          billing_address: addressFromForm(customer.address),
        }
        for (const k of ['gstin', 'pan', 'source']) if (customer[k].trim()) body.new_client[k] = customer[k].trim()
      }
      onConverted(await leadsApi.convert(orgId, lead.id, lead.version, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>Convert lead</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Creates an opportunity. A new customer starts as a prospect and becomes active when they accept a quotation.
      </p>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <div className="version-tabs">
        {canCreate && (
          <button type="button" className={`version-tab${mode === 'new' ? ' active' : ''}`} onClick={() => setMode('new')}>
            New customer
          </button>
        )}
        {canPickExisting && (
          <button
            type="button"
            className={`version-tab${mode === 'existing' ? ' active' : ''}`}
            onClick={() => setMode('existing')}
          >
            Existing customer
          </button>
        )}
      </div>

      {mode === 'existing' ? (
        <div className="field">
          <label htmlFor="existing-customer">Customer *</label>
          <select id="existing-customer" required value={existingId} onChange={(e) => setExistingId(e.target.value)}>
            <option value="">— Choose —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
      ) : (
        <CustomerFields
          form={customer}
          set={setCustomerField}
          setAddress={setAddress}
          fieldErrors={fieldErrors}
          owners={owners}
          me={me}
          isCreate
        />
      )}

      <h3 style={{ margin: '12px 0 10px', fontSize: 15 }}>Opportunity</h3>
      <div className="field">
        <label htmlFor="opp-name">Name *</label>
        <input id="opp-name" required maxLength={255} value={opportunity.name} onChange={(e) => setOpp('name', e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="opp-value">Expected value *</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="opp-value"
              type="number"
              required
              min="0"
              step="0.01"
              value={opportunity.amount}
              onChange={(e) => setOpp('amount', e.target.value)}
            />
            <input
              aria-label="Currency"
              className="mono-input"
              maxLength={3}
              style={{ width: 70 }}
              value={opportunity.currency}
              onChange={(e) => setOpp('currency', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="opp-close">Expected close date *</label>
          <input
            id="opp-close"
            type="date"
            required
            value={opportunity.expected_close_date}
            onChange={(e) => setOpp('expected_close_date', e.target.value)}
          />
        </div>
      </div>

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Converting…' : 'Convert'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
