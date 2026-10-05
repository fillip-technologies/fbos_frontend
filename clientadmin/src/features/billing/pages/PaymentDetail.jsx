import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { invoicesApi, paymentsApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { uuidv4 } from '@/shared/api/http.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import AllocationEditor, { allocatedTotal, toAllocations } from '@/features/billing/components/AllocationEditor.jsx'
import { PAYABLE_STATUSES, PAYMENT_METHODS, amountOf } from '@/features/billing/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function PaymentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [payment, setPayment] = useState(null)
  const [openInvoices, setOpenInvoices] = useState([])
  const [amounts, setAmounts] = useState({})
  const [allocating, setAllocating] = useState(null) // idempotency key while the form is open
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    paymentsApi
      .get(orgId, id)
      .then(setPayment)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

  function openAllocation() {
    setAmounts({})
    setAllocating(uuidv4())
    invoicesApi
      .listAll(orgId, { client_id: payment.client.id })
      .then((all) =>
        setOpenInvoices(
          all.filter((inv) => inv.doc_type === 'tax_invoice' && PAYABLE_STATUSES.includes(inv.status) && amountOf(inv.balance_due) > 0)
        )
      )
      .catch(setError)
  }

  async function allocate(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setPayment(await paymentsApi.allocate(orgId, payment, toAllocations(amounts, payment.amount.currency), allocating))
      setAllocating(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (!payment)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <button className="btn secondary" onClick={() => navigate('/payments')}>← Back</button>
      </div>
    )

  const unallocated = amountOf(payment.unallocated_amount)
  const canAllocate = unallocated > 0 && hasAccess(me, ACCESS.recordPayments)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{payment.code}</span> <StatusBadge status={payment.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <Link to={`/customers/${payment.client.id}`}>{payment.client.name}</Link>
          </p>
        </div>
        <div className="row-actions">
          {canAllocate && !allocating && <button className="btn" onClick={openAllocation}>Allocate to invoices…</button>}
          <button className="btn secondary" onClick={() => navigate('/payments')}>← Back</button>
        </div>
      </div>

      <ErrorBanner error={error} />
      <div className="panel">
        <div className="details-grid">
          <Detail label="Received on">{formatDate(payment.received_on)}</Detail>
          <Detail label="Amount">{formatMoney(payment.amount)}</Detail>
          <Detail label="TDS withheld">{amountOf(payment.tds_amount) > 0 && formatMoney(payment.tds_amount)}</Detail>
          <Detail label="Method">{PAYMENT_METHODS[payment.method] || payment.method}</Detail>
          <Detail label="Reference"><span className="mono">{payment.bank_reference}</span></Detail>
          <Detail label="Unallocated">
            <strong>{formatMoney(payment.unallocated_amount)}</strong>
          </Detail>
        </div>
      </div>

      {allocating && (
        <form className="inline-panel" onSubmit={allocate} style={{ marginTop: 0, marginBottom: 16 }}>
          <AllocationEditor invoices={openInvoices} amounts={amounts} setAmounts={setAmounts} available={unallocated} />
          <div className="row-actions">
            <button
              className="btn"
              type="submit"
              disabled={busy || allocatedTotal(amounts) <= 0 || allocatedTotal(amounts) > unallocated + 0.001}
            >
              {busy ? 'Allocating…' : 'Allocate'}
            </button>
            <button type="button" className="btn secondary" onClick={() => setAllocating(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel">
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Allocations</h2>
        {payment.allocations.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Not allocated to any invoice yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>On</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((a, i) => (
                <tr key={`${a.invoice_id}-${i}`} onClick={() => navigate(`/invoices/${a.invoice_id}`)}>
                  <td className="mono">{a.invoice_no || 'Invoice'}</td>
                  <td>{formatDate(a.allocated_at.slice(0, 10))}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
