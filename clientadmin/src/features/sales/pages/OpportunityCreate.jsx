import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { opportunitiesApi } from '@/features/sales/api.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { customersApi } from '@/features/customers/api.js'
import useOwners from '@/features/customers/useOwners.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { toIsoDate } from '@/shared/utils/dates.js'

function inDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

// New business with a customer already on the books (repeat business): no lead needed.
// `?customer=<id>` picks the customer (the customer page links here).
export default function OpportunityCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { owners } = useOwners(orgId)
  const ownerChoices = owners || [me].filter(Boolean)

  // Shared with the other pages naming customers (same key, same fetcher).
  const { data: customers = null } = useLookup(
    ['customers', orgId, 'all'],
    ({ signal }) => customersApi.listAll(orgId, { signal }).catch(() => []),
    { enabled: Boolean(orgId) }
  )
  // Not for inactive customers: the backend refuses them.
  const choices = (customers || []).filter((c) => c.status !== 'inactive')

  const [form, setForm] = useState({
    client_id: params.get('customer') || '',
    name: '',
    amount: '',
    currency: activeOrg?.base_currency || 'INR',
    expected_close_date: inDays(30),
    owner_user_id: me?.id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        client_id: form.client_id,
        name: form.name.trim(),
        expected_value: { amount: Number(form.amount), currency: form.currency.trim().toUpperCase() },
        expected_close_date: form.expected_close_date,
      }
      if (form.owner_user_id) body.owner_user_id = form.owner_user_id
      const created = await opportunitiesApi.create(orgId, body)
      invalidate(['opportunities', orgId])
      navigate(`/opportunities/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const chosen = choices.find((c) => c.id === form.client_id)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New opportunity</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            New business with a customer you already have. New enquiries start as leads instead.
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="new-opp-customer">Customer *</label>
            <select
              id="new-opp-customer"
              required
              value={form.client_id}
              disabled={customers === null}
              onChange={(e) => set('client_id', e.target.value)}
            >
              <option value="">{customers === null ? 'Loading…' : '— Choose —'}</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}){c.status === 'prospect' ? ' · prospect' : ''}
                </option>
              ))}
            </select>
            {chosen && (
              <div className="muted small" style={{ marginTop: 4 }}>
                <Link to={`/customers/${chosen.id}`}>Open customer</Link>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="new-opp-owner">Owner</label>
            <select id="new-opp-owner" value={form.owner_user_id} onChange={(e) => set('owner_user_id', e.target.value)}>
              {ownerChoices.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-opp-name">Name *</label>
          <input
            id="new-opp-name"
            required
            maxLength={255}
            placeholder="e.g. Website redesign 2027"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="new-opp-value">Expected value *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="new-opp-value"
                type="number"
                required
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
              />
              <input
                aria-label="Currency"
                className="mono-input"
                maxLength={3}
                style={{ width: 70 }}
                value={form.currency}
                onChange={(e) => set('currency', e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-opp-close">Expected close date *</label>
            <input
              id="new-opp-close"
              type="date"
              required
              value={form.expected_close_date}
              onChange={(e) => set('expected_close_date', e.target.value)}
            />
          </div>
        </div>
        <div className="row-actions">
          <button className="btn" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? 'Creating…' : 'Create opportunity'}
          </button>
        </div>
      </form>
    </div>
  )
}
