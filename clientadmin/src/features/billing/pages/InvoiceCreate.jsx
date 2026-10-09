import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { contractOptions, invoicesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import TaxCategorySelect from '@/features/tax/components/TaxCategorySelect.jsx'
import { useTaxCategories } from '@/features/tax/useTaxConfig.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { invalidate } from '@/shared/api/useQuery.js'

const newLine = () => ({ description: '', sac_code: '', quantity: '1', unit_price: '', tax_category_code: '', discount: '' })

// Draft invoice: customer, optional contract, lines. Taxes are worked out by the backend from
// each line's tax category, the company's registration and the customer's state, and again
// at the issue date's rates when the draft is issued (that is when it gets its number).
export default function InvoiceCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const currency = activeOrg?.base_currency || 'INR'
  const { categories } = useTaxCategories(orgId)
  const [customers, setCustomers] = useState([])
  const [contracts, setContracts] = useState([])
  const [form, setForm] = useState({
    client_id: params.get('customer') || '',
    contract_id: params.get('contract') || '',
    due_date: '',
  })
  const [lines, setLines] = useState([newLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) return
    customersApi.listAll(orgId).then(setCustomers).catch(setError)
  }, [orgId])

  useEffect(() => {
    if (!orgId || !form.client_id) {
      setContracts([])
      return
    }
    contractOptions(orgId, form.client_id)
      .then(setContracts)
      .catch(() => setContracts([]))
  }, [orgId, form.client_id])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setLine = (index, k, v) => setLines(lines.map((l, i) => (i === index ? { ...l, [k]: v } : l)))
  const contract = contracts.find((c) => c.id === form.contract_id)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        client_id: form.client_id,
        lines: lines.map((l) => {
          const line = {
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unit_price: { amount: Number(l.unit_price), currency },
          }
          if (l.tax_category_code) line.tax_category_code = l.tax_category_code
          if (l.sac_code.trim()) line.sac_code = l.sac_code.trim()
          if (l.discount !== '' && Number(l.discount) > 0) line.discount = { amount: Number(l.discount), currency }
          return line
        }),
      }
      if (form.contract_id) body.contract_id = form.contract_id
      if (form.due_date) body.due_date = form.due_date
      const created = await invoicesApi.createDraft(orgId, body)
      invalidate(['invoices', orgId])
      navigate(`/invoices/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New invoice</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”, amounts in {currency}</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate('/invoices')}>Cancel</button>
      </div>
      <ErrorBanner error={error} />
      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="inv-customer">Customer *</label>
            <select
              id="inv-customer"
              required
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value, contract_id: '' }))}
            >
              <option value="">— Choose —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inv-contract">Contract</label>
            <select
              id="inv-contract"
              value={form.contract_id}
              disabled={!contracts.length}
              onChange={(e) => set('contract_id', e.target.value)}
            >
              <option value="">{contracts.length ? '— None —' : 'No contracts'}</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.contract_no} · {formatMoney(c.total_value)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inv-due">Due date</label>
            <input id="inv-due" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            <div className="hint">Blank: the company’s payment terms after issue.</div>
          </div>
        </div>

        {contract && (
          <div className="alert info">
            An active contract is billed from its billing schedule, one line at a time as each falls due, so nothing is billed twice.
            {hasAccess(me, ACCESS.billingSchedules) && (
              <>
                {' '}
                <Link to={`/billing-schedules?contract=${contract.id}`}>Open {contract.contract_no}’s billing schedule</Link>.
              </>
            )}
            {' '}Use this form only for charges outside the schedule.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: 110 }}>SAC</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 130 }}>Unit price</th>
                <th style={{ width: 200 }}>Tax category</th>
                <th style={{ width: 110 }}>Discount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, index) => (
                <tr key={index} style={{ cursor: 'default' }}>
                  <td>
                    <input aria-label="Description" required value={l.description} onChange={(e) => setLine(index, 'description', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="SAC" className="mono-input" maxLength={20} placeholder="From category" value={l.sac_code} onChange={(e) => setLine(index, 'sac_code', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="Quantity" type="number" required min="0.0001" step="any" value={l.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="Unit price" type="number" required min="0" step="0.01" value={l.unit_price} onChange={(e) => setLine(index, 'unit_price', e.target.value)} />
                  </td>
                  <td>
                    <TaxCategorySelect aria-label="Tax category" categories={categories} value={l.tax_category_code} onChange={(v) => setLine(index, 'tax_category_code', v)} />
                  </td>
                  <td>
                    <input aria-label="Discount amount" type="number" min="0" step="0.01" value={l.discount} onChange={(e) => setLine(index, 'discount', e.target.value)} />
                  </td>
                  <td>
                    {lines.length > 1 && (
                      <button type="button" className="btn secondary small-btn" aria-label="Remove line" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn secondary small-btn" style={{ marginTop: 8 }} onClick={() => setLines([...lines, newLine()])}>
            + Add line
          </button>
        </div>

        <div className="row-actions" style={{ marginTop: 14 }}>
          <button className="btn" type="submit" disabled={saving || !orgId}>{saving ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>
    </div>
  )
}
