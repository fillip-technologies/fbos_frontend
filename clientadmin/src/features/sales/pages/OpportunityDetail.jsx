import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { contractsApi, offeringsApi, opportunitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { useRecordForm } from '@/shared/utils/useRecordForm.js'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { toIsoDate } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import ContractForm from '@/features/sales/components/ContractForm.jsx'
import CustomerEmailForm, { contractEmailProps, quotationEmailProps } from '@/features/sales/components/CustomerEmailForm.jsx'
import {
  QuotationActionForm,
  QuotationActionMenu,
  performQuotationAction,
  quotationActions,
} from '@/features/sales/components/QuotationActions.jsx'
import QuotationItemsEditor, { newItem, rowsToItems } from '@/features/sales/components/QuotationItemsEditor.jsx'
import {
  CONTRACT_EMAILABLE,
  LOST_REASONS,
  OPEN_QUOTATION_STATUSES,
  OPEN_STAGES,
  QUOTATION_CLOSED_TO_FILES,
  QUOTATION_STATUS_LABELS,
  SUBJECTS,
  humanize,
} from '@/features/sales/utils.js'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

const toForm = (o) => ({
  stage: o.stage,
  probability: String(o.probability),
  amount: String(Number(o.expected_value.amount)),
  expected_close_date: o.expected_close_date || '',
})

function inDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

function NewQuotation({ orgId, opportunityId, onCreated, onCancel }) {
  const { data: offerings = null, error: offeringsError } = useLookup(['offerings', orgId, 'all'], ({ signal }) =>
    offeringsApi.listAll(orgId, { signal })
  )
  const [rows, setRows] = useState([newItem()])
  const [name, setName] = useState('')
  const [validUntil, setValidUntil] = useState(inDays(30))
  const [terms, setTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { valid_until: validUntil, items: rowsToItems(rows, offerings) }
      if (name.trim()) body.name = name.trim()
      if (terms.trim()) body.terms = terms.trim()
      onCreated(await opportunitiesApi.createQuotation(orgId, opportunityId, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>New quotation</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Several options can be open at once; the main one sets the expected value. Accepting one closes the others.
      </p>
      <ErrorBanner error={error || offeringsError} />
      {offerings === null ? (
        !offeringsError && <div className="center-note">Loading offerings…</div>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="q-name">Option name</label>
            <input
              id="q-name"
              maxLength={120}
              placeholder="e.g. Option A – Basic"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <QuotationItemsEditor rows={rows} setRows={setRows} offerings={offerings} />
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="q-valid">Valid until *</label>
              <input id="q-valid" type="date" required value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="q-terms">Terms</label>
              <input id="q-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
        </>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !offerings?.length}>
          {saving ? 'Creating…' : 'Create draft'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

export default function OpportunityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const { ownerName } = useOwners(orgId)
  const canManage = hasAccess(me, ACCESS.manageOpportunities)
  const canSeeContracts = hasAccess(me, ACCESS.contracts)
  const canApprove = hasAccess(me, ACCESS.approveQuotations)

  const oppQuery = useQuery(['opportunity', orgId, id], ({ signal }) => opportunitiesApi.get(orgId, id, { signal }), {
    enabled: Boolean(orgId),
  })
  const quotationsQuery = useQuery(['quotations', orgId, { opportunity: id }], ({ signal }) =>
    opportunitiesApi.quotations(orgId, id, { signal }), { enabled: Boolean(orgId) }
  )
  // Whether the customer is still a prospect (it becomes active when it accepts a quotation).
  const clientId = oppQuery.data?.client.id
  const { data: customer } = useQuery(
    ['customer', orgId, clientId],
    ({ signal }) => customersApi.get(orgId, clientId, { signal }),
    { enabled: Boolean(orgId && clientId) && hasAccess(me, ACCESS.customers) }
  )
  const contractsQuery = useQuery(
    ['contracts', orgId, { opportunity_id: id }],
    ({ signal }) => contractsApi.list(orgId, { opportunity_id: id, limit: 100 }, { signal }),
    { enabled: Boolean(orgId) && canSeeContracts }
  )
  const opp = oppQuery.data
  const quotations = quotationsQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []
  const loading = oppQuery.loading || quotationsQuery.loading || (canSeeContracts && contractsQuery.loading)
  const loadError = oppQuery.error || quotationsQuery.error || (canSeeContracts ? contractsQuery.error : null)
  const reload = () => {
    oppQuery.reload()
    quotationsQuery.reload()
    if (canSeeContracts) contractsQuery.reload()
  }
  const setOpp = (next) => {
    oppQuery.setData(next)
    invalidate(['opportunities', orgId])
  }
  const { form, setForm, base, rebase } = useRecordForm(opp, toForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // null | 'quotation' | 'lost' | 'contract' | 'email' | 'quotation-action'
  const [panel, setPanel] = useState(null)
  // The quotation an email or a quotation action is about, and which action.
  const [acting, setActing] = useState(null) // { quote, action }
  const [emailed, setEmailed] = useState(null)
  // The contract being emailed from the contract panel.
  const [emailingContract, setEmailingContract] = useState(null)
  const [contractEmailed, setContractEmailed] = useState(null)
  // Remounts the timeline so the logged email shows.
  const [timelineKey, setTimelineKey] = useState(0)
  const [lost, setLost] = useState({ reason: 'price', competitor: '', note: '' })
  const fieldErrors = getFieldErrors(error)


  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // A quotation changed: its status may have moved the stage, and it may be on the timeline.
  function quotationChanged(quote) {
    setPanel(null)
    setActing(null)
    invalidate(['quotations', orgId])
    // Making one main, or accepting one, changes the others too.
    invalidate(['quotation', orgId])
    invalidate(['quotation-events', orgId])
    invalidate(['opportunities', orgId])
    // Accepting makes a prospect a customer.
    invalidate(['customer', orgId])
    invalidate(['customers', orgId])
    quotationsQuery.reload()
    oppQuery.reload()
    setTimelineKey((k) => k + 1)
  }

  async function pickQuotationAction(quote, action) {
    setError(null)
    setEmailed(null)
    if (action.key === 'open') return navigate(`/quotations/${quote.id}`)
    if (action.key === 'contract') return setPanel('contract')
    if (action.key === 'email' || action.key === 'emailAgain') {
      setActing({ quote, action: 'email' })
      return setPanel('email')
    }
    if (action.kind === 'form') {
      setActing({ quote, action: action.key })
      return setPanel('quotation-action')
    }
    setSaving(true)
    try {
      quotationChanged(await performQuotationAction(orgId, quote, action.key))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const original = toForm(base) // what the form was taken from, not a newer refresh
      const body = {}
      if (form.stage !== original.stage) body.stage = form.stage
      if (form.probability !== original.probability) body.probability = Number(form.probability)
      if (form.amount !== original.amount) body.expected_value = { amount: Number(form.amount), currency: opp.expected_value.currency }
      if (form.expected_close_date !== original.expected_close_date) body.expected_close_date = form.expected_close_date
      if (Object.keys(body).length) {
        const updated = await opportunitiesApi.update(orgId, id, base.version, body)
        setOpp(updated)
        rebase(updated)
      }
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function markLost(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { reason: lost.reason }
      if (lost.competitor.trim()) body.competitor = lost.competitor.trim()
      if (lost.note.trim()) body.note = lost.note.trim()
      const updated = await opportunitiesApi.markLost(orgId, id, opp.version, body)
      setOpp(updated)
      rebase(updated)
      setPanel(null)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading || (opp && !form)) return <DetailSkeleton />
  if (!opp)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/opportunities')}>← Back</button>
      </div>
    )

  const open = OPEN_STAGES.includes(opp.stage)
  const accepted = quotations.find((q) => q.status === 'accepted')
  // The main option's files (they carry over on revise); else the newest quotation's.
  const currentQuote =
    quotations.find((q) => q.is_main && OPEN_QUOTATION_STATUSES.includes(q.status)) || accepted || quotations[0]
  const canCreateContract = accepted && contracts.length === 0 && hasAccess(me, ACCESS.manageContracts)
  const canAddQuotation = canManage && open

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {opp.name} <StatusBadge status={opp.stage} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{opp.code}</span> · <Link to={`/customers/${opp.client.id}`}>{opp.client.name}</Link>
            {customer?.status === 'prospect' && (
              <>
                {' '}
                <StatusBadge status="prospect" label="Prospect" />
              </>
            )}
            {opp.lead_id && (
              <>
                {' · '}
                <Link to={`/leads/${opp.lead_id}`}>from lead</Link>
              </>
            )}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/opportunities')}>← Back</button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {!error && <ErrorBanner error={loadError} onRetry={reload} />}

      <div className="panel">
        {canManage && open ? (
          <form onSubmit={handleSave}>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="opp-stage">Stage</label>
                <select id="opp-stage" value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                  {OPEN_STAGES.map((s) => (
                    <option key={s} value={s}>{humanize(s)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="opp-prob">Probability %</label>
                <input
                  id="opp-prob"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) => set('probability', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="opp-close">Close by</label>
                <input
                  id="opp-close"
                  type="date"
                  value={form.expected_close_date}
                  onChange={(e) => set('expected_close_date', e.target.value)}
                />
              </div>
            </div>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="opp-amount">Expected value ({opp.expected_value.currency})</label>
                <input
                  id="opp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                />
              </div>
              <Detail label="Owner">{ownerName(opp.owner.id)}</Detail>
            </div>
            <div className="row-actions">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              {!panel && (
                <button type="button" className="btn danger-outline" onClick={() => setPanel('lost')}>Mark lost…</button>
              )}
            </div>
          </form>
        ) : (
          <div className="details-grid">
            <Detail label="Expected value">{formatMoney(opp.expected_value)}</Detail>
            <Detail label="Probability">{opp.probability}%</Detail>
            <Detail label="Close by">{formatDate(opp.expected_close_date)}</Detail>
            <Detail label="Owner">{ownerName(opp.owner.id)}</Detail>
            {opp.lost_reason && <Detail label="Lost because">{opp.lost_reason}</Detail>}
          </div>
        )}

        {panel === 'lost' && (
          <form className="inline-panel" onSubmit={markLost}>
            <h3>Mark lost</h3>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="lost-reason">Reason</label>
                <select id="lost-reason" value={lost.reason} onChange={(e) => setLost((l) => ({ ...l, reason: e.target.value }))}>
                  {Object.entries(LOST_REASONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="lost-competitor">Competitor</label>
                <input
                  id="lost-competitor"
                  value={lost.competitor}
                  onChange={(e) => setLost((l) => ({ ...l, competitor: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="lost-note">Note</label>
                <input id="lost-note" value={lost.note} onChange={(e) => setLost((l) => ({ ...l, note: e.target.value }))} />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn danger" type="submit" disabled={saving}>Mark lost</button>
              <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={saving}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="panel">
        <div className="section-head">
          <h2 style={{ fontSize: 17 }}>Quotations</h2>
          {canAddQuotation && panel !== 'quotation' && (
            <button className="btn small-btn" onClick={() => setPanel('quotation')}>+ New quotation</button>
          )}
        </div>
        {emailed && (
          <div className="alert success" role="status">
            Sent from {emailed.from_name} &lt;{emailed.from_address}&gt; to {emailed.to.join(', ')}
            {emailed.cc.length > 0 && <> · Cc {emailed.cc.join(', ')}</>}
            {emailed.bcc.length > 0 && <> · Bcc {emailed.bcc.join(', ')}</>}
            {' · '}
            {emailed.attachments.length
              ? `${emailed.attachments.length} file${emailed.attachments.length > 1 ? 's' : ''}: ${emailed.attachments.map((f) => f.file_name).join(', ')}`
              : 'no files'}
          </div>
        )}
        {panel === 'email' && acting && (
          <CustomerEmailForm
            key={acting.quote.id}
            orgId={orgId}
            {...quotationEmailProps(orgId, acting.quote)}
            canSeeFiles={hasAccess(me, ACCESS.documents)}
            onSent={(sent) => {
              quotationChanged(sent.quotation)
              setEmailed(sent)
            }}
            onCancel={() => setPanel(null)}
          />
        )}
        {panel === 'quotation-action' && acting && (
          <QuotationActionForm
            key={`${acting.quote.id}-${acting.action}`}
            orgId={orgId}
            quote={acting.quote}
            action={acting.action}
            onDone={quotationChanged}
            onCancel={() => setPanel(null)}
          />
        )}
        {panel === 'quotation' && (
          <NewQuotation
            orgId={orgId}
            opportunityId={opp.id}
            onCreated={(q) => {
              invalidate(['quotations', orgId])
              navigate(`/quotations/${q.id}`)
            }}
            onCancel={() => setPanel(null)}
          />
        )}
        {quotations.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No quotations yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th aria-label="Main" />
                <th>Status</th>
                <th>Total</th>
                <th>Valid until</th>
                <th>Last sent</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td>
                    {q.name ? (
                      <>
                        <div>{q.name}</div>
                        <div className="muted small mono">{q.quote_no} · rev {q.revision_no}</div>
                      </>
                    ) : (
                      <span className="mono">{q.quote_no} · rev {q.revision_no}</span>
                    )}
                  </td>
                  <td>
                    {q.is_main && (
                      <span className="main-star" title="Main quotation: sets the expected value" aria-label="Main quotation">★</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={q.status} label={QUOTATION_STATUS_LABELS[q.status]} />
                    {q.is_expired && <> <StatusBadge status="expired" label="Expired" /></>}
                  </td>
                  <td>{formatMoney(q.totals.grand_total)}</td>
                  <td>{formatDate(q.valid_until)}</td>
                  <td>{q.last_sent_at ? formatDate(q.last_sent_at.slice(0, 10)) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <QuotationActionMenu
                      actions={quotationActions(q, { canManage, canApprove, canCreateContract, opportunityOpen: open })}
                      disabled={saving}
                      onPick={(action) => pickQuotationAction(q, action)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {currentQuote && hasAccess(me, ACCESS.documents) && (
        <DocumentPanel
          key={currentQuote.id}
          orgId={orgId}
          subjectType={DOCUMENT_SUBJECTS.quotation}
          subjectId={currentQuote.id}
          title={`Quotation documents · ${currentQuote.quote_no} rev ${currentQuote.revision_no}`}
          canAttach={
            canManage && hasAccess(me, ACCESS.uploadDocuments) && !QUOTATION_CLOSED_TO_FILES.includes(currentQuote.status)
          }
          defaultCategory="quotation"
        />
      )}

      {canSeeContracts && (accepted || contracts.length > 0) && (
        <div className="panel">
          <div className="section-head">
            <h2 style={{ fontSize: 17 }}>Contract</h2>
            {canCreateContract && panel !== 'contract' && (
              <button className="btn small-btn" onClick={() => setPanel('contract')}>Create contract</button>
            )}
          </div>
          {panel === 'contract' && (
            <ContractForm
              orgId={orgId}
              quotation={accepted}
              onCreated={(c) => {
                invalidate(['contracts', orgId])
                navigate(`/contracts/${c.id}`)
              }}
              onCancel={() => setPanel(null)}
            />
          )}
          {contracts.length === 0 ? (
            panel !== 'contract' && <p className="muted small" style={{ margin: 0 }}>The quotation was accepted. Create the contract next.</p>
          ) : (
            contracts.map((c) => (
              <div key={c.id} className="section-head" style={{ margin: 0 }}>
                <p style={{ margin: 0 }}>
                  <Link to={`/contracts/${c.id}`} className="mono">{c.contract_no}</Link> <StatusBadge status={c.status} />{' '}
                  <span className="muted small">{formatMoney(c.total_value)}</span>
                  {['draft', 'pending_signature'].includes(c.status) && (
                    <span className="muted small">
                      {' · '}
                      {c.signed_document_id ? 'signed copy attached: activate it on the contract page' : 'waiting for the signed copy'}
                    </span>
                  )}
                </p>
                {hasAccess(me, ACCESS.manageContracts) && CONTRACT_EMAILABLE.includes(c.status) && emailingContract?.id !== c.id && (
                  <button
                    className="btn secondary small-btn"
                    onClick={() => {
                      setContractEmailed(null)
                      setEmailingContract(c)
                    }}
                  >
                    Email contract
                  </button>
                )}
              </div>
            ))
          )}
          {contractEmailed && (
            <div className="alert success" role="status" style={{ marginTop: 10 }}>
              Emailed {contractEmailed.contract.contract_no} to {contractEmailed.to.join(', ')}
              {contractEmailed.attachments.length > 0 && ` with ${contractEmailed.attachments.map((f) => f.file_name).join(', ')}`}.
            </div>
          )}
          {emailingContract && (
            <CustomerEmailForm
              key={emailingContract.id}
              orgId={orgId}
              {...contractEmailProps(orgId, emailingContract)}
              canSeeFiles={hasAccess(me, ACCESS.documents)}
              onSent={(sent) => {
                setContractEmailed(sent)
                setEmailingContract(null)
                invalidate(['contract', orgId, sent.contract.id])
                setTimelineKey((k) => k + 1)
              }}
              onCancel={() => setEmailingContract(null)}
            />
          )}
        </div>
      )}

      {hasAccess(me, ACCESS.activities) && (
        <ActivityTimeline key={timelineKey} orgId={orgId} subjectType={SUBJECTS.opportunity} subjectId={opp.id} />
      )}
    </div>
  )
}
