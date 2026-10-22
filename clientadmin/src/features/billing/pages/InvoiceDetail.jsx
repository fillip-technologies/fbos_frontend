import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { invoicesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import TaxCategorySelect from '@/features/tax/components/TaxCategorySelect.jsx'
import TaxTotals, { LineTaxes, TaxNotes } from '@/features/tax/components/TaxTotals.jsx'
import { useTaxCategories } from '@/features/tax/useTaxConfig.js'
import { SUPPLY_TYPES, errorMeta } from '@/features/tax/utils.js'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'
import { CREDIT_REASONS, DEBIT_REASONS, DOC_TYPES, amountOf, isPastDue, isPayable } from '@/features/billing/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

const money = (amount, currency) => ({ amount: Number(amount), currency })

// Credit by original line: each keeps that line's tax category, so it is taxed as it was.
function CreditLines({ invoice, amounts, setAmounts }) {
  return (
    <table style={{ marginBottom: 10 }}>
      <thead>
        <tr>
          <th>Line</th>
          <th style={{ textAlign: 'right' }}>Taxable</th>
          <th style={{ width: 160 }}>Credit (before tax)</th>
        </tr>
      </thead>
      <tbody>
        {invoice.lines.map((line) => (
          <tr key={line.line_no} style={{ cursor: 'default' }}>
            <td>{line.description}</td>
            <td style={{ textAlign: 'right' }}>{formatMoney(line.taxable_value)}</td>
            <td>
              <input
                aria-label={`Credit for line ${line.line_no}`}
                type="number"
                min="0"
                max={amountOf(line.taxable_value)}
                step="0.01"
                value={amounts[line.line_no] || ''}
                onChange={(e) => setAmounts({ ...amounts, [line.line_no]: e.target.value })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// New charges for a debit note: description, amount before tax and its tax category.
function DebitLines({ rows, setRows, categories }) {
  const update = (index, k, v) => setRows(rows.map((row, i) => (i === index ? { ...row, [k]: v } : row)))
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ width: 150 }}>Amount (before tax)</th>
            <th style={{ width: 220 }}>Tax category</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{ cursor: 'default' }}>
              <td><input aria-label="Description" required value={row.description} onChange={(e) => update(index, 'description', e.target.value)} /></td>
              <td><input aria-label="Amount" type="number" required min="0.01" step="0.01" value={row.amount} onChange={(e) => update(index, 'amount', e.target.value)} /></td>
              <td><TaxCategorySelect aria-label="Tax category" categories={categories} value={row.category} onChange={(v) => update(index, 'category', v)} /></td>
              <td>
                {rows.length > 1 && (
                  <button type="button" className="btn secondary small-btn" aria-label="Remove line" onClick={() => setRows(rows.filter((_, i) => i !== index))}>✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn secondary small-btn" style={{ margin: '8px 0 12px' }} onClick={() => setRows([...rows, { description: '', amount: '', category: rows[0]?.category || '' }])}>
        + Add line
      </button>
    </>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(me, ACCESS.manageInvoices)

  const {
    data: invoice,
    error: loadError,
    loading,
    reload,
    setData: setInvoice,
  } = useQuery(['invoice', orgId, id], ({ signal }) => invoicesApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const { categories } = useTaxCategories(orgId, { enabled: canManage })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // null | { kind: 'issue' | 'credit' | 'debit' | 'write_off', key, ...fields }
  const [panel, setPanel] = useState(null)

  const open = (kind, fields) => {
    setError(null)
    setPanel({ kind, key: uuidv4(), ...fields })
  }

  async function run(action, { navigateTo } = {}) {
    setError(null)
    setBusy(true)
    try {
      const result = await action()
      invalidate(['invoices', orgId])
      if (navigateTo) {
        invalidate(['invoice', orgId, invoice.id])
        navigate(`/invoices/${result.id}`)
      } else {
        setInvoice(result)
        setPanel(null)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function submit(e) {
    e.preventDefault()
    const currency = invoice.currency
    if (panel.kind === 'issue') {
      const body = panel.issue_date && panel.issue_date !== todayIso() ? { issue_date: panel.issue_date } : undefined
      return run(() => invoicesApi.issue(orgId, invoice, body, panel.key))
    }
    if (panel.kind === 'credit') {
      const body = { reason: panel.reason }
      if (panel.note.trim()) body.note = panel.note.trim()
      if (panel.override_reason.trim()) body.override_reason = panel.override_reason.trim()
      if (panel.scope === 'lines') {
        body.lines = invoice.lines
          .filter((line) => Number(panel.amounts[line.line_no]) > 0)
          .map((line) => ({
            description: `Credit: ${line.description}`,
            unit_price: money(panel.amounts[line.line_no], currency),
            tax_category_code: line.tax_category_code || undefined,
            sac_code: line.sac_code || undefined,
          }))
      }
      return run(() => invoicesApi.creditNote(orgId, invoice, body, panel.key), { navigateTo: true })
    }
    if (panel.kind === 'debit') {
      const body = {
        reason: panel.reason,
        lines: panel.rows.map((row) => ({
          description: row.description.trim(),
          unit_price: money(row.amount, currency),
          tax_category_code: row.category || undefined,
        })),
      }
      if (panel.note.trim()) body.note = panel.note.trim()
      return run(() => invoicesApi.debitNote(orgId, invoice, body, panel.key), { navigateTo: true })
    }
    return run(() => invoicesApi.writeOff(orgId, invoice, { amount: money(panel.amount, currency), reason: panel.reason.trim() }, panel.key))
  }

  if (loading) return <DetailSkeleton />
  if (!invoice)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/invoices')}>← Back</button>
      </div>
    )

  const isTaxInvoice = invoice.doc_type === 'tax_invoice'
  const issued = Boolean(invoice.invoice_no)
  const payable = isPayable(invoice)
  const correctable = canManage && isTaxInvoice && issued && !['cancelled', 'draft'].includes(invoice.status)
  const creditTotal = Object.values(panel?.amounts || {}).reduce((sum, v) => sum + Number(v || 0), 0)
  const overrideAllowed = error?.code === 'CREDIT_NOTE_DEADLINE_PASSED' && errorMeta(error)?.override_allowed
  const credited = amountOf(invoice.credited_amount)
  const writtenOff = amountOf(invoice.written_off_amount)

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
            {invoice.schedule_line_id && invoice.contract_id && (
              <>
                {' · '}
                <Link to={`/billing-schedules?contract=${invoice.contract_id}`}>Billing schedule</Link>
              </>
            )}
            {invoice.original_invoice_id && (
              <>
                {invoice.doc_type === 'debit_note' ? ' · adds to ' : ' · credits '}
                <Link to={`/invoices/${invoice.original_invoice_id}`}>the original invoice</Link>
              </>
            )}
          </p>
        </div>
        <div className="row-actions">
          {canManage && invoice.status === 'draft' && !panel && (
            <button className="btn" onClick={() => open('issue', { issue_date: todayIso() })}>Issue…</button>
          )}
          {payable && hasAccess(me, ACCESS.recordPayments) && (
            <Link className="btn" to={`/payments/new?customer=${invoice.client.id}&invoice=${invoice.id}`}>Record payment</Link>
          )}
          {correctable && !panel && (
            <>
              <button className="btn secondary" onClick={() => open('credit', { reason: 'price_correction', note: '', override_reason: '', scope: 'whole', amounts: {} })}>
                Credit note…
              </button>
              <button
                className="btn secondary"
                onClick={() => open('debit', { reason: 'additional_charges', note: '', rows: [{ description: '', amount: '', category: invoice.lines[0]?.tax_category_code || '' }] })}
              >
                Debit note…
              </button>
            </>
          )}
          {payable && hasAccess(me, ACCESS.writeOffInvoices) && !panel && (
            <button className="btn secondary" onClick={() => open('write_off', { amount: String(amountOf(invoice.balance_due)), reason: '' })}>
              Write off…
            </button>
          )}
          <button className="btn secondary" onClick={() => navigate('/invoices')}>← Back</button>
        </div>
      </div>

      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />
      {isPastDue(invoice) && invoice.status !== 'overdue' && (
        <div className="alert warn">Past its due date with money still owed. The next collections refresh marks it overdue.</div>
      )}

      {panel?.kind === 'issue' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Issue invoice</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Issuing gives the invoice its number and works out its GST at the rates in effect on the issue date, then freezes it.
            Mistakes are corrected with a credit or debit note. GST is owed on the invoice whether or not it is paid.
          </p>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="issue-date">Issue date</label>
            <input id="issue-date" type="date" max={todayIso()} value={panel.issue_date} onChange={(e) => setPanel({ ...panel, issue_date: e.target.value })} />
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Issuing…' : 'Issue invoice'}</button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {panel?.kind === 'credit' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Credit note</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Corrects the invoice: its tax treatment is copied, and it lowers what the customer owes. It is not a payment, and isn’t
            the way to record money that won’t be paid (write it off instead).
          </p>
          <div className="row-actions" style={{ marginBottom: 10 }}>
            <label className="inline-check">
              <input type="radio" name="cn-scope" checked={panel.scope === 'whole'} onChange={() => setPanel({ ...panel, scope: 'whole' })} />
              The whole invoice
            </label>
            <label className="inline-check">
              <input type="radio" name="cn-scope" checked={panel.scope === 'lines'} onChange={() => setPanel({ ...panel, scope: 'lines' })} />
              Part of some lines
            </label>
          </div>
          {panel.scope === 'lines' && <CreditLines invoice={invoice} amounts={panel.amounts} setAmounts={(amounts) => setPanel({ ...panel, amounts })} />}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cn-reason">Reason</label>
              <select id="cn-reason" value={panel.reason} onChange={(e) => setPanel({ ...panel, reason: e.target.value })}>
                {Object.entries(CREDIT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cn-note">Note</label>
              <input id="cn-note" value={panel.note} onChange={(e) => setPanel({ ...panel, note: e.target.value })} />
            </div>
          </div>
          {(overrideAllowed || panel.override_reason) && (
            <div className="field">
              <label htmlFor="cn-override">Why it is raised after the deadline *</label>
              <input id="cn-override" required minLength={3} value={panel.override_reason} onChange={(e) => setPanel({ ...panel, override_reason: e.target.value })} />
              <div className="hint">Kept on the credit note.</div>
            </div>
          )}
          <div className="row-actions">
            <button className="btn danger" type="submit" disabled={busy || (panel.scope === 'lines' && creditTotal <= 0)} aria-busy={busy}>
              {busy ? 'Raising…' : 'Raise credit note'}
            </button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {panel?.kind === 'debit' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Debit note</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Raises what the customer owes (an undercharge, extra charges), taxed as the original invoice was. It is paid like an invoice.
          </p>
          <DebitLines rows={panel.rows} setRows={(rows) => setPanel({ ...panel, rows })} categories={categories} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="dn-reason">Reason</label>
              <select id="dn-reason" value={panel.reason} onChange={(e) => setPanel({ ...panel, reason: e.target.value })}>
                {Object.entries(DEBIT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dn-note">Note</label>
              <input id="dn-note" value={panel.note} onChange={(e) => setPanel({ ...panel, note: e.target.value })} />
            </div>
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Raising…' : 'Raise debit note'}</button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {panel?.kind === 'write_off' && (
        <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 16 }}>
          <h3>Write off</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Stop expecting part of the balance. This changes no tax: GST already due on an issued invoice isn’t reduced because it
            wasn’t paid.
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="wo-amount">Amount *</label>
              <input id="wo-amount" type="number" required min="0.01" max={amountOf(invoice.balance_due)} step="0.01" value={panel.amount} onChange={(e) => setPanel({ ...panel, amount: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="wo-reason">Reason *</label>
              <input id="wo-reason" required minLength={3} value={panel.reason} onChange={(e) => setPanel({ ...panel, reason: e.target.value })} />
            </div>
          </div>
          <div className="row-actions">
            <button className="btn danger" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Writing off…' : 'Write off'}</button>
            <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="details-grid">
          <Detail label="Issued">{invoice.issue_date && formatDate(invoice.issue_date)}</Detail>
          <Detail label="Due">{invoice.due_date && formatDate(invoice.due_date)}</Detail>
          <Detail label="Total">{formatMoney(invoice.totals.grand_total)}</Detail>
          <Detail label="Paid (incl. TDS withheld)">{formatMoney(invoice.amount_settled)}</Detail>
          {credited > 0 && <Detail label="Credited">{formatMoney(invoice.credited_amount)}</Detail>}
          {writtenOff > 0 && <Detail label="Written off">{formatMoney(invoice.written_off_amount)}</Detail>}
          <Detail label={invoice.doc_type === 'credit_note' ? 'Owed back to the customer' : 'Balance due'}>
            <strong>{formatMoney(invoice.balance_due)}</strong>
          </Detail>
          <Detail label="Supplier GSTIN"><span className="mono">{invoice.supplier_gstin}</span></Detail>
          <Detail label="Customer GSTIN"><span className="mono">{invoice.recipient_gstin}</span></Detail>
          <Detail label="Place of supply">
            {invoice.place_of_supply}
            {invoice.supply_type && <div className="muted small">{SUPPLY_TYPES[invoice.supply_type] || invoice.supply_type}</div>}
          </Detail>
          {invoice.tax_point_date && <Detail label="Taxed as of">{formatDate(invoice.tax_point_date)}</Detail>}
          {invoice.client_snapshot && (
            <Detail label="Billed to">
              {invoice.client_snapshot.legal_name}
              {invoice.client_snapshot.address && <div className="muted small">{invoice.client_snapshot.address}</div>}
            </Detail>
          )}
        </div>
        {invoice.deadlines?.length > 0 && (
          <ul className="small muted" style={{ margin: '12px 0 0', paddingLeft: 18 }}>
            {invoice.deadlines.map((deadline) => (
              <li key={deadline.code}>
                {formatDate(deadline.due_on)}: {deadline.description}
              </li>
            ))}
          </ul>
        )}
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
              <th>Tax</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.line_no} style={{ cursor: 'default' }}>
                <td>{l.line_no}</td>
                <td>
                  {l.description}
                  <div className="muted small">
                    {l.sac_code && <span className="mono">SAC {l.sac_code}</span>}
                    {l.tax_category_code && <span> · {l.tax_category_code}</span>}
                  </div>
                </td>
                <td>{l.quantity}</td>
                <td>
                  {formatMoney(l.unit_price)}
                  {amountOf(l.discount) > 0 && <div className="muted small">− {formatMoney(l.discount)}</div>}
                </td>
                <td>{formatMoney(l.taxable_value)}</td>
                <td className="small"><LineTaxes line={l} /></td>
                <td style={{ textAlign: 'right' }}>{formatMoney(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}>
          <TaxTotals totals={invoice.totals} withholding={invoice.withholding} netReceivable={invoice.net_receivable} />
        </div>
        <TaxNotes notes={invoice.tax_notes} />
        {invoice.status === 'draft' && (
          <p className="muted small" style={{ marginBottom: 0 }}>Taxes are worked out again at the rates in effect on the issue date.</p>
        )}
      </div>
    </div>
  )
}
