import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { invoicesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { uuidv4 } from '@/shared/api/http.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'
import { CREDIT_REASONS, DOC_TYPES, PAYABLE_STATUSES, amountOf, isPastDue } from '@/features/billing/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(me, ACCESS.manageInvoices)

  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // null | { kind: 'issue', issue_date, key } | { kind: 'credit', reason, note, key }
  const [panel, setPanel] = useState(null)

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    invoicesApi
      .get(orgId, id)
      .then(setInvoice)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (panel.kind === 'issue') {
        const body = panel.issue_date && panel.issue_date !== todayIso() ? { issue_date: panel.issue_date } : undefined
        setInvoice(await invoicesApi.issue(orgId, invoice, body, panel.key))
        setPanel(null)
      } else {
        const body = { reason: panel.reason }
        if (panel.note.trim()) body.note = panel.note.trim()
        const credit = await invoicesApi.creditNote(orgId, invoice, body, panel.key)
        navigate(`/invoices/${credit.id}`)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (!invoice)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <button className="btn secondary" onClick={() => navigate('/invoices')}>← Back</button>
      </div>
    )

  const isTaxInvoice = invoice.doc_type === 'tax_invoice'
  const payable = isTaxInvoice && PAYABLE_STATUSES.includes(invoice.status) && amountOf(invoice.balance_due) > 0
  const interState = amountOf(invoice.totals.igst_total) > 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{invoice.invoice_no || 'Draft invoice'}</span> <StatusBadge status={invoice.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {DOC_TYPES[invoice.doc_type]} · <Link to={`/customers/${invoice.client.id}`}>{invoice.client.name}</Link>
            {invoice.contract_id && (
              <>
                {' · '}
                <Link to={`/contracts/${invoice.contract_id}`}>Contract</Link>
              </>
            )}
            {invoice.original_invoice_id && (
              <>
                {' · credits '}
                <Link to={`/invoices/${invoice.original_invoice_id}`}>the original invoice</Link>
              </>
            )}
          </p>
        </div>
        <div className="row-actions">
          {canManage && invoice.status === 'draft' && !panel && (
            <button className="btn" onClick={() => setPanel({ kind: 'issue', issue_date: todayIso(), key: uuidv4() })}>
              Issue…
            </button>
          )}
          {payable && hasAccess(me, ACCESS.recordPayments) && (
            <Link className="btn" to={`/payments/new?customer=${invoice.client.id}&invoice=${invoice.id}`}>Record payment</Link>
          )}
          {canManage && isTaxInvoice && invoice.invoice_no && !panel && (
            <button
              className="btn secondary"
              onClick={() => setPanel({ kind: 'credit', reason: 'price_correction', note: '', key: uuidv4() })}
            >
              Credit note…
            </button>
          )}
          <button className="btn secondary" onClick={() => navigate('/invoices')}>← Back</button>
        </div>
      </div>

      <ErrorBanner error={error} />
      {isPastDue(invoice) && invoice.status !== 'overdue' && (
        <div className="alert warn">Past its due date with money still owed. The next collections refresh marks it overdue.</div>
      )}

      {panel?.kind === 'issue' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Issue invoice</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Issuing gives the invoice its number and freezes it. Mistakes are then corrected with a credit note.
          </p>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="issue-date">Issue date</label>
            <input
              id="issue-date"
              type="date"
              max={todayIso()}
              value={panel.issue_date}
              onChange={(e) => setPanel({ ...panel, issue_date: e.target.value })}
            />
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Issuing…' : 'Issue invoice'}</button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {panel?.kind === 'credit' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Credit note</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Reverses the whole invoice and lowers its balance by the credited amount.
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cn-reason">Reason</label>
              <select id="cn-reason" value={panel.reason} onChange={(e) => setPanel({ ...panel, reason: e.target.value })}>
                {Object.entries(CREDIT_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cn-note">Note</label>
              <input id="cn-note" value={panel.note} onChange={(e) => setPanel({ ...panel, note: e.target.value })} />
            </div>
          </div>
          <div className="row-actions">
            <button className="btn danger" type="submit" disabled={busy}>{busy ? 'Raising…' : 'Raise credit note'}</button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="details-grid">
          <Detail label="Issued">{invoice.issue_date && formatDate(invoice.issue_date)}</Detail>
          <Detail label="Due">{invoice.due_date && formatDate(invoice.due_date)}</Detail>
          <Detail label="Total">{formatMoney(invoice.totals.grand_total)}</Detail>
          <Detail label="Paid / credited">{formatMoney(invoice.amount_settled)}</Detail>
          <Detail label="Balance due">
            <strong>{formatMoney(invoice.balance_due)}</strong>
          </Detail>
          <Detail label="Supplier GSTIN"><span className="mono">{invoice.supplier_gstin}</span></Detail>
          <Detail label="Customer GSTIN"><span className="mono">{invoice.recipient_gstin}</span></Detail>
          <Detail label="Place of supply">{invoice.place_of_supply}</Detail>
          {invoice.client_snapshot && (
            <Detail label="Billed to">
              {invoice.client_snapshot.legal_name}
              {invoice.client_snapshot.address && <div className="muted small">{invoice.client_snapshot.address}</div>}
            </Detail>
          )}
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Taxable</th>
              <th>GST</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.line_no} style={{ cursor: 'default' }}>
                <td>{l.line_no}</td>
                <td>
                  {l.description}
                  {l.sac_code && <div className="muted small mono">SAC {l.sac_code}</div>}
                </td>
                <td>{l.quantity}</td>
                <td>
                  {formatMoney(l.unit_price)}
                  {amountOf(l.discount) > 0 && <div className="muted small">− {formatMoney(l.discount)}</div>}
                </td>
                <td>{formatMoney(l.taxable_value)}</td>
                <td className="small">
                  {l.gst_rate}%
                  <div className="muted">
                    {interState ? `IGST ${formatMoney(l.igst)}` : `CGST ${formatMoney(l.cgst)} · SGST ${formatMoney(l.sgst)}`}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>{formatMoney(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 12 }}>
          <tbody>
            <tr style={{ cursor: 'default' }}>
              <td className="muted">Taxable</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(invoice.totals.taxable_total)}</td>
            </tr>
            {interState ? (
              <tr style={{ cursor: 'default' }}>
                <td className="muted">IGST</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(invoice.totals.igst_total)}</td>
              </tr>
            ) : (
              <>
                <tr style={{ cursor: 'default' }}>
                  <td className="muted">CGST</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(invoice.totals.cgst_total)}</td>
                </tr>
                <tr style={{ cursor: 'default' }}>
                  <td className="muted">SGST</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(invoice.totals.sgst_total)}</td>
                </tr>
              </>
            )}
            <tr style={{ cursor: 'default' }}>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(invoice.totals.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
