import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { invoicesApi, paymentsApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import AllocationEditor, { allocatedTotal, rowsFit, toAllocations } from '@/features/billing/components/AllocationEditor.jsx'
import { PAYMENT_METHODS, amountOf, isPayable } from '@/features/billing/utils.js'

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
  const {
    data: payment,
    error: loadError,
    loading,
    reload,
    setData,
  } = useQuery(['payment', orgId, id], ({ signal }) => paymentsApi.get(orgId, id, { signal }), {
    enabled: Boolean(orgId),
  })
  // Saves a changed payment into the cache; its list is refetched on the next visit.
  const setPayment = (next) => {
    setData(next)
    invalidate(['payments', orgId])
  }
  const [openInvoices, setOpenInvoices] = useState([])
  const [rows, setRows] = useState({})
  const [allocating, setAllocating] = useState(null) // idempotency key while the form is open
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function openAllocation() {
    setRows({})
    setAllocating(uuidv4())
    invoicesApi
      .listAll(orgId, { client_id: payment.client.id })
      .then((all) =>
        setOpenInvoices(
          all.filter(isPayable)
        )
      )
      .catch(setError)
  }

  async function allocate(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setPayment(await paymentsApi.allocate(orgId, payment, toAllocations(rows, payment.amount.currency), allocating))
      invalidate(['tds-receivables', orgId])
      invalidate(['invoices', orgId]) // the allocated invoices' balances changed
      invalidate(['invoice', orgId])
      setAllocating(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (!payment)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
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

      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />
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
          <AllocationEditor invoices={openInvoices} rows={rows} setRows={setRows} available={unallocated} />
          <div className="row-actions">
            <button
              className="btn"
              type="submit"
              disabled={busy || toAllocations(rows, payment.amount.currency).length === 0 || allocatedTotal(rows) > unallocated + 0.001 || !rowsFit(rows, openInvoices)}
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
                <th style={{ textAlign: 'right' }}>Cash</th>
                <th style={{ textAlign: 'right' }}>TDS withheld</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((a, i) => (
                <tr key={`${a.invoice_id}-${i}`} onClick={() => navigate(`/invoices/${a.invoice_id}`)}>
                  <td className="mono">{a.invoice_no || 'Invoice'}</td>
                  <td>{formatDate(a.allocated_at.slice(0, 10))}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(a.amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {amountOf(a.tds_amount) > 0 ? formatMoney(a.tds_amount) : <span className="muted">—</span>}
                    {a.tds_section_code && <div className="muted small">{a.tds_section_code}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
