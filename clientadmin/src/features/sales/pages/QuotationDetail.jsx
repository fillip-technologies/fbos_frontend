import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { offeringsApi, quotationsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { useRecordForm } from '@/shared/utils/useRecordForm.js'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import QuotationItemsEditor, { itemToRow, rowsToItems } from '@/features/sales/components/QuotationItemsEditor.jsx'
import { QUOTATION_CLOSED_TO_FILES, QUOTATION_STATUS_LABELS, REVISABLE_STATUSES } from '@/features/sales/utils.js'
import TaxTotals, { LineTaxes, TaxNotes } from '@/features/tax/components/TaxTotals.jsx'
import { SUPPLY_TYPES } from '@/features/tax/utils.js'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'

// What happens next, by status.
const NEXT_STEP = {
  draft: 'Check the lines, then submit. Discounts over 20% go for approval first.',
  pending_approval: 'Waiting for someone with approval rights to approve the discount.',
  approved: 'Approved. Send it to the customer.',
  sent: 'Sent. Record the customer’s answer: accepted or rejected.',
  accepted: 'Accepted: the opportunity is won. Create the contract from the opportunity.',
  rejected: 'Rejected. Revise it to make a new offer.',
  superseded: 'Replaced by a newer revision.',
}

// A draft's lines as editable rows; null rows once it is no longer a draft.
const toRows = (q) => ({ rows: q.status === 'draft' ? q.items.map(itemToRow) : null })

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(me, ACCESS.manageOpportunities)
  const canApprove = hasAccess(me, ACCESS.approveQuotations)

  const {
    data: quote,
    error: loadError,
    loading,
    reload,
    setData,
  } = useQuery(['quotation', orgId, id], ({ signal }) => quotationsApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const { data: offerings = [] } = useLookup(['offerings', orgId, 'all'], ({ signal }) => offeringsApi.listAll(orgId, { signal }), {
    enabled: Boolean(orgId) && canManage,
  })
  // Editable lines while a draft; `base` is the revision they were taken from.
  const { form: lines, setForm: setLines, base, rebase } = useRecordForm(quote, toRows)
  const rows = lines?.rows ?? null
  const setRows = (next) => setLines((l) => ({ rows: typeof next === 'function' ? next(l.rows) : next }))
  const [rejecting, setRejecting] = useState(null) // reason being typed
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const show = (q) => {
    setData(q)
    rebase(q)
    setRejecting(null)
    invalidate(['quotations', orgId])
    invalidate(['opportunity', orgId])
    invalidate(['opportunities', orgId])
  }

  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      const result = await action()
      // Revising answers with the new revision.
      if (result.id !== quote.id) navigate(`/quotations/${result.id}`)
      else show(result)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading || (quote && !lines)) return <DetailSkeleton />
  if (!quote)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>
    )

  const editing = canManage && quote.status === 'draft' && rows
  const itemsChanged = editing && JSON.stringify(rows) !== JSON.stringify(base.items.map(itemToRow))
  const offeringName = (offeringId) => offerings.find((o) => o.id === offeringId)?.name

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{quote.quote_no}</span> · rev {quote.revision_no} <StatusBadge status={quote.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <Link to={`/customers/${quote.client.id}`}>{quote.client.name}</Link>
            {quote.opportunity_id && (
              <>
                {' · '}
                <Link to={`/opportunities/${quote.opportunity_id}`}>Opportunity</Link>
              </>
            )}
            {` · valid until ${formatDate(quote.valid_until)} · place of supply ${quote.place_of_supply}`}
            {quote.supply_type && ` (${(SUPPLY_TYPES[quote.supply_type] || quote.supply_type).toLowerCase()})`}
          </p>
        </div>
        {quote.opportunity_id ? (
          <Link className="btn secondary" to={`/opportunities/${quote.opportunity_id}`}>← Opportunity</Link>
        ) : (
          <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
        )}
      </div>

      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />
      <div className="alert info">
        <strong>{QUOTATION_STATUS_LABELS[quote.status] || quote.status}.</strong> {NEXT_STEP[quote.status] || ''}
      </div>

      <div className="panel">
        {editing ? (
          <QuotationItemsEditor rows={rows} setRows={setRows} offerings={offerings} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Disc.</th>
                  <th>Tax</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((i) => (
                  <tr key={i.line_no} style={{ cursor: 'default' }}>
                    <td>{i.line_no}</td>
                    <td>
                      <div>{offeringName(i.offering_id) || i.description || 'Offering'}</div>
                      {i.description && offeringName(i.offering_id) && <div className="muted small">{i.description}</div>}
                      {i.sac_code && <div className="muted small mono">SAC {i.sac_code}</div>}
                    </td>
                    <td>{i.quantity} {i.unit}</td>
                    <td>{formatMoney(i.unit_price)}</td>
                    <td>{i.discount_pct ? `${i.discount_pct}%` : '—'}</td>
                    <td className="small"><LineTaxes line={i} /></td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <TaxTotals totals={quote.totals} withholding={quote.withholding} netReceivable={quote.net_receivable} />
          {itemsChanged && <p className="muted small" style={{ textAlign: 'right' }}>Totals update when the lines are saved.</p>}
        </div>
        <TaxNotes notes={quote.tax_notes} />
        {['draft', 'pending_approval', 'approved'].includes(quote.status) && (
          <p className="muted small">Taxes are worked out again at the rates in effect when it is sent, then kept as sent.</p>
        )}
        {quote.terms && <p className="small"><strong>Terms:</strong> {quote.terms}</p>}

        {rejecting !== null && (
          <form
            className="inline-panel"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => quotationsApi.reject(orgId, quote, { reason: rejecting.trim() }))
            }}
          >
            <div className="field">
              <label htmlFor="reject-reason">Why did the customer reject it? *</label>
              <input id="reject-reason" required maxLength={512} value={rejecting} onChange={(e) => setRejecting(e.target.value)} />
            </div>
            <div className="row-actions">
              <button className="btn danger" type="submit" disabled={busy}>Record rejection</button>
              <button type="button" className="btn secondary" onClick={() => setRejecting(null)} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}

        {canManage && rejecting === null && (
          <div className="row-actions" style={{ marginTop: 16 }}>
            {quote.status === 'draft' && (
              <>
                <button
                  className="btn secondary"
                  disabled={busy || !itemsChanged}
                  onClick={() => run(() => quotationsApi.replaceItems(orgId, base, rowsToItems(rows, offerings)))}
                >
                  Save lines
                </button>
                <button
                  className="btn"
                  disabled={busy || itemsChanged}
                  title={itemsChanged ? 'Save the lines first' : undefined}
                  onClick={() => run(() => quotationsApi.submit(orgId, quote))}
                >
                  Submit
                </button>
              </>
            )}
            {quote.status === 'pending_approval' && canApprove && (
              <button className="btn" disabled={busy} onClick={() => run(() => quotationsApi.approve(orgId, quote))}>
                Approve discount
              </button>
            )}
            {quote.status === 'approved' && (
              <button className="btn" disabled={busy} onClick={() => run(() => quotationsApi.send(orgId, quote))}>
                Mark as sent
              </button>
            )}
            {quote.status === 'sent' && (
              <>
                <button className="btn" disabled={busy} onClick={() => run(() => quotationsApi.accept(orgId, quote))}>
                  Customer accepted
                </button>
                <button className="btn danger-outline" disabled={busy} onClick={() => setRejecting('')}>
                  Customer rejected…
                </button>
              </>
            )}
            {REVISABLE_STATUSES.includes(quote.status) && (
              <button className="btn secondary" disabled={busy} onClick={() => run(() => quotationsApi.revise(orgId, quote))}>
                Revise
              </button>
            )}
          </div>
        )}
      </div>

      {hasAccess(me, ACCESS.documents) && (
        <DocumentPanel
          orgId={orgId}
          subjectType={DOCUMENT_SUBJECTS.quotation}
          subjectId={quote.id}
          canAttach={canManage && hasAccess(me, ACCESS.uploadDocuments) && !QUOTATION_CLOSED_TO_FILES.includes(quote.status)}
          defaultCategory="quotation"
        />
      )}
    </div>
  )
}
