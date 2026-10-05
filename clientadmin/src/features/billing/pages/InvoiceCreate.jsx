import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { contractOptions, invoicesApi } from '@/features/billing/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { round2 } from '@/features/billing/utils.js'

const newLine = (description = '') => ({
  description,
  sac_code: '998314',
  quantity: '1',
  unit_price: '',
  gst_rate: '18',
  discount: '',
})

const TRIGGER_LABELS = {
  advance: 'Advance',
  milestone: 'Milestone',
  date: 'Scheduled',
  monthly: 'Monthly',
  on_completion: 'On completion',
}

// Draft invoice: customer, optional contract, lines. Taxes (CGST/SGST or IGST) are worked
// out by the backend from the customer's state. A draft gets its number when issued.
export default function InvoiceCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { orgId, activeOrg } = useActiveOrg()
  const currency = activeOrg?.base_currency || 'INR'
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

  // A payment-schedule entry as a line: its share of the contract value, before GST.
  function addTermLine(term) {
    const gst = 18
    const share = term.percent != null ? (Number(contract.total_value.amount) * term.percent) / 100 : Number(term.amount?.amount || 0)
    const line = {
      ...newLine(`${contract.contract_no} · ${TRIGGER_LABELS[term.trigger_type] || term.trigger_type}${term.milestone_code ? ` (${term.milestone_code})` : ''}${term.percent != null ? ` · ${term.percent}%` : ''}`),
      unit_price: String(round2(share / (1 + gst / 100))),
      gst_rate: String(gst),
    }
    setLines((current) => (current.length === 1 && !current[0].description && !current[0].unit_price ? [line] : [...current, line]))
  }

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
            gst_rate: Number(l.gst_rate),
          }
          if (l.sac_code.trim()) line.sac_code = l.sac_code.trim()
          if (l.discount !== '' && Number(l.discount) > 0) line.discount = { amount: Number(l.discount), currency }
          return line
        }),
      }
      if (form.contract_id) body.contract_id = form.contract_id
      if (form.due_date) body.due_date = form.due_date
      const created = await invoicesApi.createDraft(orgId, body)
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
            <div className="hint">Blank: 15 days after issue.</div>
          </div>
        </div>

        {contract && (
          <div className="inline-panel" style={{ marginTop: 0, marginBottom: 14 }}>
            <h3>Payment schedule of {contract.contract_no}</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Add an entry as a line. Its share of the contract value is split back into price + 18% GST; adjust if needed.
            </p>
            {contract.payment_terms.map((t) => (
              <div key={t.seq} className="row-actions" style={{ marginBottom: 6, alignItems: 'center' }}>
                <span>
                  {TRIGGER_LABELS[t.trigger_type] || t.trigger_type}
                  {t.milestone_code && ` · ${t.milestone_code}`}
                  {t.percent != null ? ` · ${t.percent}%` : ` · ${formatMoney(t.amount)}`}
                </span>
                <button type="button" className="btn secondary small-btn" onClick={() => addTermLine(t)}>Add as line</button>
              </div>
            ))}
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
                <th style={{ width: 80 }}>GST %</th>
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
                    <input aria-label="SAC" className="mono-input" maxLength={20} value={l.sac_code} onChange={(e) => setLine(index, 'sac_code', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="Quantity" type="number" required min="0.0001" step="any" value={l.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="Unit price" type="number" required min="0" step="0.01" value={l.unit_price} onChange={(e) => setLine(index, 'unit_price', e.target.value)} />
                  </td>
                  <td>
                    <input aria-label="GST rate" type="number" required min="0" max="100" step="any" value={l.gst_rate} onChange={(e) => setLine(index, 'gst_rate', e.target.value)} />
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
