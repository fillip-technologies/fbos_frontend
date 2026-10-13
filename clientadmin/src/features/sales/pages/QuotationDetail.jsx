import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { offeringsApi, opportunitiesApi, quotationsApi } from '@/features/sales/api.js'
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
import { OPEN_STAGES, QUOTATION_CLOSED_TO_FILES, QUOTATION_STATUS_LABELS, WITHDRAWAL_REASONS } from '@/features/sales/utils.js'
import {
  QuotationActionForm,
  performQuotationAction,
  quotationActions,
} from '@/features/sales/components/QuotationActions.jsx'
import QuotationEmailForm from '@/features/sales/components/QuotationEmailForm.jsx'
import QuotationHistory from '@/features/sales/components/QuotationHistory.jsx'
import TaxTotals, { LineTaxes, TaxNotes } from '@/features/tax/components/TaxTotals.jsx'
import { SUPPLY_TYPES } from '@/features/tax/utils.js'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'

// What happens next, by status.
const NEXT_STEP = {
  draft: 'Check the lines, then submit. Discounts over 20% go for approval first.',
  pending_approval: 'Waiting for someone with approval rights to approve the discount.',
  approved: 'Approved. Send it to the customer.',
  sent: 'Sent. Record the customer’s answer: accepted, changes requested or rejected.',
  changes_requested: 'The customer asked for changes. Revise it to answer them.',
  accepted: 'Accepted: the opportunity is won. Create the contract from the opportunity.',
  rejected: 'Rejected. Revise it to make a new offer.',
  withdrawn: 'Withdrawn: we took it back.',
  superseded: 'Replaced by a newer revision.',
  not_chosen: 'Another quotation on the opportunity was accepted.',
}
// Moving these on sends what is saved, so unsaved lines must be saved first.
const NEEDS_SAVED_LINES = ['submit', 'email', 'send']

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
  // Whether new options may still be added (duplicates): only while the opportunity is open.
  const opportunityId = quote?.opportunity_id
  const { data: opportunity } = useQuery(
    ['opportunity', orgId, opportunityId],
    ({ signal }) => opportunitiesApi.get(orgId, opportunityId, { signal }),
    { enabled: Boolean(orgId && opportunityId) }
  )
  const { data: offerings = [] } = useLookup(['offerings', orgId, 'all'], ({ signal }) => offeringsApi.listAll(orgId, { signal }), {
    enabled: Boolean(orgId) && canManage,
  })
  // Editable lines while a draft; `base` is the revision they were taken from.
  const { form: lines, setForm: setLines, base, rebase } = useRecordForm(quote, toRows)
  const rows = lines?.rows ?? null
  const setRows = (next) => setLines((l) => ({ rows: typeof next === 'function' ? next(l.rows) : next }))
  // null | 'email' | a QuotationActionForm action
  const [panel, setPanel] = useState(null)
  const [emailed, setEmailed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const show = (q) => {
    setData(q)
    rebase(q)
    setPanel(null)
    invalidate(['quotation-events', orgId])
    invalidate(['quotations', orgId])
    // Making this one main changes the opportunity's others.
    if (q.is_main) invalidate(['quotation', orgId])
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
  // Creating the contract happens on the opportunity, next to the contract panel.
  const actions = quotationActions(quote, {
    canManage,
    canApprove,
    canCreateContract: Boolean(quote.opportunity_id) && hasAccess(me, ACCESS.manageContracts),
    opportunityOpen: OPEN_STAGES.includes(opportunity?.stage),
  })

  function pick(action) {
    setEmailed(null)
    if (action.kind === 'run') return run(() => performQuotationAction(orgId, quote, action.key))
    if (action.key === 'email' || action.key === 'emailAgain') return setPanel('email')
    if (action.key === 'contract') return navigate(`/opportunities/${quote.opportunity_id}`)
    if (action.kind === 'form') return setPanel(action.key)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {quote.name && <>{quote.name} · </>}
            <span className="mono">{quote.quote_no}</span> · rev {quote.revision_no}{' '}
            <StatusBadge status={quote.status} label={QUOTATION_STATUS_LABELS[quote.status]} />
            {quote.is_main && (
              <span className="main-star" title="Main quotation: sets the expected value" aria-label="Main quotation"> ★</span>
            )}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <Link to={`/customers/${quote.client.id}`}>{quote.client.name}</Link>
            {quote.opportunity_id && (
              <>
                {' · '}
                <Link to={`/opportunities/${quote.opportunity_id}`}>Opportunity</Link>
              </>
            )}
            {` · valid until ${formatDate(quote.valid_until)}`}
            {quote.is_expired && <> <StatusBadge status="expired" label="Expired" /></>}
            {quote.last_sent_at && ` · last sent ${formatDate(quote.last_sent_at.slice(0, 10))}`}
            {` · place of supply ${quote.place_of_supply}`}
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
        {quote.is_expired && ' Its validity has run out: extend it, or accept it anyway if the customer agreed.'}
        {quote.status_note && ['changes_requested', 'rejected', 'withdrawn'].includes(quote.status) && (
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {quote.status === 'withdrawn' && quote.status_reason && <strong>{WITHDRAWAL_REASONS[quote.status_reason]}: </strong>}
            {quote.status_note}
          </div>
        )}
      </div>
      {emailed && (
        <div className="alert success" role="status">
          Emailed to {emailed.to.join(', ')}
          {emailed.attachments.length > 0 && ` with ${emailed.attachments.map((f) => f.file_name).join(', ')}`}.
        </div>
      )}

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

        {panel === 'email' && (
          <QuotationEmailForm
            orgId={orgId}
            quote={quote}
            canSeeFiles={hasAccess(me, ACCESS.documents)}
            onSent={(sent) => {
              show(sent.quotation)
              setEmailed(sent)
            }}
            onCancel={() => setPanel(null)}
          />
        )}
        {panel && panel !== 'email' && (
          <QuotationActionForm
            orgId={orgId}
            quote={quote}
            action={panel}
            onDone={(result) => {
              if (result.id === quote.id) return show(result)
              invalidate(['quotations', orgId])
              navigate(`/quotations/${result.id}`) // a duplicate
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {!panel && (editing || actions.length > 0) && (
          <div className="row-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            {editing && (
              <button
                className="btn secondary"
                disabled={busy || !itemsChanged}
                onClick={() => run(() => quotationsApi.replaceItems(orgId, base, rowsToItems(rows, offerings)))}
              >
                Save lines
              </button>
            )}
            {actions
              .filter((a) => a.key !== 'open')
              .map((a, i) => {
                const blocked = itemsChanged && NEEDS_SAVED_LINES.includes(a.key)
                return (
                  <button
                    key={a.key}
                    className={a.danger ? 'btn danger-outline' : i === 0 ? 'btn' : 'btn secondary'}
                    disabled={busy || blocked}
                    title={blocked ? 'Save the lines first' : undefined}
                    onClick={() => pick(a)}
                  >
                    {a.label}
                  </button>
                )
              })}
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

      <QuotationHistory orgId={orgId} quotationId={quote.id} />
    </div>
  )
}
