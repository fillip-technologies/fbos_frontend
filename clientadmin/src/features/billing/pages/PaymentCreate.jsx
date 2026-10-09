import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { invoicesApi, paymentsApi } from '@/features/billing/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { customersApi } from '@/features/customers/api.js'
import { uuidv4 } from '@/shared/api/http.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import AllocationEditor, { allocatedTotal, cashExpected, rowsFit, toAllocations } from '@/features/billing/components/AllocationEditor.jsx'
import { PAYMENT_METHODS, expectedTds, isPayable } from '@/features/billing/utils.js'
import { invalidate } from '@/shared/api/useQuery.js'

// Money received from a customer, optionally split across their open invoices right away.
export default function PaymentCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { orgId, activeOrg } = useActiveOrg()
  const currency = activeOrg?.base_currency || 'INR'
  // One key for this form: a retried submit can't record the payment twice.
  const [idempotencyKey] = useState(uuidv4)
  const [customers, setCustomers] = useState([])
  const [openInvoices, setOpenInvoices] = useState([])
  const [form, setForm] = useState({
    client_id: params.get('customer') || '',
    received_on: todayIso(),
    amount: '',
    method: 'bank_transfer',
    bank_reference: '',
  })
  const [rows, setRows] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const preselected = params.get('invoice')

  useEffect(() => {
    if (!orgId) return
    customersApi.listAll(orgId).then(setCustomers).catch(setError)
  }, [orgId])

  useEffect(() => {
    if (!orgId || !form.client_id) {
      setOpenInvoices([])
      return
    }
    invoicesApi
      .listAll(orgId, { client_id: form.client_id })
      .then((all) => {
        const open = all.filter(isPayable)
        setOpenInvoices(open)
        // Paying a chosen invoice: its expected cash, and the TDS the customer is expected to keep.
        const target = open.find((inv) => inv.id === preselected)
        const tds = target ? expectedTds(target) : 0
        setRows(target ? { [target.id]: { cash: String(cashExpected(target)), tds: tds > 0 ? String(tds) : '' } } : {})
        if (target) setForm((f) => (f.amount ? f : { ...f, amount: String(cashExpected(target)) }))
      })
      .catch(setError)
  }, [orgId, form.client_id, preselected])

  // Cash only: TDS withheld is entered per invoice and never came through the bank.
  const available = Number(form.amount || 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        client_id: form.client_id,
        received_on: form.received_on,
        amount: { amount: Number(form.amount), currency },
        method: form.method,
      }
      if (form.bank_reference.trim()) body.bank_reference = form.bank_reference.trim()
      const allocations = toAllocations(rows, currency)
      if (allocations.length) body.allocations = allocations
      const payment = await paymentsApi.record(orgId, body, idempotencyKey)
      invalidate(['payments', orgId])
      invalidate(['invoices', orgId]) // allocations change balances
      navigate(`/payments/${payment.id}`, { replace: true })
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
          <h1>Record payment</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”, amounts in {currency}</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      <ErrorBanner error={error} />
      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="pay-customer">Customer *</label>
            <select id="pay-customer" required value={form.client_id} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">— Choose —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pay-date">Received on *</label>
            <input
              id="pay-date"
              type="date"
              required
              max={todayIso()}
              value={form.received_on}
              onChange={(e) => set('received_on', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pay-method">Method</label>
            <select id="pay-method" value={form.method} onChange={(e) => set('method', e.target.value)}>
              {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pay-amount">Amount received *</label>
            <input
              id="pay-amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pay-ref">Bank / UTR reference</label>
            <input id="pay-ref" value={form.bank_reference} onChange={(e) => set('bank_reference', e.target.value)} />
          </div>
        </div>

        {form.client_id && (
          <div className="inline-panel" style={{ marginTop: 0, marginBottom: 14 }}>
            <AllocationEditor invoices={openInvoices} rows={rows} setRows={setRows} available={available} />
          </div>
        )}

        <div className="row-actions">
          <button className="btn" type="submit" disabled={saving || !orgId || allocatedTotal(rows) > available + 0.001 || !rowsFit(rows, openInvoices)}>
            {saving ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </div>
  )
}
