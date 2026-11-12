import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { contractsApi, offeringsApi, opportunitiesApi, proposalsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { customersApi } from '@/features/customers/api.js'
import { formatMoney } from '@/features/customers/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import DealStepper, { dealSteps } from '@/features/sales/components/DealStepper.jsx'
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
  proposalLabel,
} from '@/features/sales/utils.js'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import ProposalsSection from '@/features/sales/components/ProposalsSection.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// The stage isn't edited: it follows the proposal and the quotations.
const toForm = (o) => ({
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
  const proposalsQuery = useQuery(['proposals', orgId, id], ({ signal }) => proposalsApi.list(orgId, id, { signal }), {
    enabled: Boolean(orgId),
  })
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
  const loading = oppQuery.loading || quotationsQuery.loading || proposalsQuery.loading || (canSeeContracts && contractsQuery.loading)
  const loadError = oppQuery.error || quotationsQuery.error || (canSeeContracts ? contractsQuery.error : null)
  const reload = () => {
    oppQuery.reload()
    quotationsQuery.reload()
    proposalsQuery.reload()
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
  // The page's sections: 'proposal' | 'quotations' | 'contract' | 'files' | 'activity'; null: the one for the step.
  const [tab, setTab] = useState(null)
  // The summary is read-only until "Edit details".
  const [editing, setEditing] = useState(false)
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
    if (action.key === 'contract') {
      setTab('contract')
      return setPanel('contract')
    }
    // Forms for a quotation open in the Quotations tab.
    setTab('quotations')
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
      if (form.probability !== original.probability) body.probability = Number(form.probability)
      if (form.amount !== original.amount) body.expected_value = { amount: Number(form.amount), currency: opp.expected_value.currency }
      if (form.expected_close_date !== original.expected_close_date) body.expected_close_date = form.expected_close_date
      if (Object.keys(body).length) {
        const updated = await opportunitiesApi.update(orgId, id, base.version, body)
        setOpp(updated)
        rebase(updated)
      }
      setEditing(false)
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
  const canManageContracts = hasAccess(me, ACCESS.manageContracts)
  const canCreateContract = accepted && contracts.length === 0 && canManageContracts
  const proposals = proposalsQuery.data?.data ?? []
  const proposal = proposals[0]
  const acceptedProposal = proposals.find((p) => p.status === 'accepted')
  // A sale from a lead is quoted from its accepted proposal (deals quoted before proposals carry on).
  const needsProposal = Boolean(opp.lead_id) && quotations.length === 0 && !acceptedProposal
  const canAddQuotation = canManage && open && !needsProposal
  const canSeeFiles = Boolean(currentQuote) && hasAccess(me, ACCESS.documents)
  const canSeeActivity = hasAccess(me, ACCESS.activities)
  const mainQuote = quotations.find((q) => q.is_main && q.status !== 'superseded')
  const openQuote =
    quotations.find((q) => q.is_main && OPEN_QUOTATION_STATUSES.includes(q.status)) ||
    quotations.find((q) => OPEN_QUOTATION_STATUSES.includes(q.status))
  const steps = dealSteps({ opp, proposals, quotations, contracts, customer, canSeeContracts })
  const actionsFor = (q) => quotationActions(q, { canManage, canApprove, canCreateContract, opportunityOpen: open })
  const quoteName = (q) => q.name || `${q.quote_no} rev ${q.revision_no}`

  function startNewQuotation() {
    setTab('quotations')
    setPanel('quotation')
  }

  async function quoteFromProposal() {
    setError(null)
    setSaving(true)
    try {
      const quote = await proposalsApi.quote(orgId, acceptedProposal)
      invalidate(['proposals', orgId])
      navigate(`/quotations/${quote.id}`)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  // The project delivering the sale: its customer, contract and sale filled in, the accepted
  // proposal's and quotation's files attached to it once made.
  function startProject() {
    const contract = contracts.find((c) => c.status === 'active') || contracts[0]
    const params = new URLSearchParams({ customer: opp.client.id, name: opp.name, opportunity: opp.id })
    if (contract) params.set('contract', contract.id)
    if (opp.deal_id) params.set('deal', opp.deal_id)
    if (accepted) params.set('quotation', accepted.id)
    if (acceptedProposal) params.set('proposal', acceptedProposal.id)
    navigate(`/projects/new?${params}`)
  }
  const canStartProject = hasAccess(me, ACCESS.manageProjects)

  // The one thing to do now, with its button. Every action comes from quotationActions(), so
  // nobody is offered a step they may not take.
  function nextStep() {
    if (opp.stage === 'lost') {
      return { tone: 'lost', text: `This proposal was marked lost${opp.lost_reason ? `: ${opp.lost_reason}` : ''}.` }
    }
    const contract = contracts.find((c) => c.status === 'active') || contracts[0]
    if (contract?.status === 'active') {
      return {
        tone: 'done',
        text: `Contract ${contract.contract_no} is active and ${opp.client.name} is a customer. Delivery and billing carry on from the contract.`,
        primary: { label: 'Open contract', run: () => navigate(`/contracts/${contract.id}`) },
        secondary: canStartProject ? [{ label: 'Start the project', run: startProject }] : [],
      }
    }
    if (contract) {
      const emailable = canManageContracts && CONTRACT_EMAILABLE.includes(contract.status)
      return {
        text: contract.signed_document_id
          ? `The signed copy of ${contract.contract_no} is attached. Activate the contract to make ${opp.client.name} a customer and start delivery.`
          : `Contract ${contract.contract_no} is waiting for the customer's signature. Send it, then attach the signed copy.`,
        primary: { label: 'Open contract', run: () => navigate(`/contracts/${contract.id}`) },
        secondary: [
          ...(emailable
            ? [{ label: 'Email contract', run: () => { setTab('contract'); setContractEmailed(null); setEmailingContract(contract) } }]
            : []),
          ...(canStartProject ? [{ label: 'Start the project', run: startProject }] : []),
        ],
      }
    }
    if (accepted) {
      return {
        tone: 'done',
        text: `${quoteName(accepted)} was accepted and ${opp.client.name} is a customer. Create the contract for billing, and start the project.`,
        primary: canCreateContract ? { label: 'Create contract', run: () => { setTab('contract'); setPanel('contract') } } : null,
        secondary: canStartProject ? [{ label: 'Start the project', run: startProject }] : [],
      }
    }
    // Before any quotation, a sale from a lead goes through its proposal.
    const toProposal = () => setTab('proposal')
    if (needsProposal) {
      if (!proposal) {
        return {
          text: 'Write the proposal: what you will do for the customer. The requirements from your calls are already in it.',
          primary: canManage && open ? { label: 'Start proposal', run: toProposal } : null,
        }
      }
      const name = `Proposal ${proposalLabel(proposal)}`
      const proposalTexts = {
        draft: `${name} is a draft. Finish it, check the PDF, and email it to the customer.`,
        sent: `${name} is with the customer. Record their feedback or answer when you hear back.`,
        under_discussion: `${name} is under discussion. Revise it, or record the customer's answer.`,
        rejected: `${name} was rejected. Revise it into a new version, or mark the deal lost.`,
      }
      return { text: proposalTexts[proposal.status] || `${name} needs your attention.`, primary: { label: 'Open proposal', run: toProposal } }
    }
    if (acceptedProposal && quotations.length === 0) {
      return {
        tone: 'done',
        text: `The customer accepted proposal ${proposalLabel(acceptedProposal)}. Make the quotation from it: its services are copied and taxed.`,
        primary: canManage && open ? { label: 'Create quotation', run: quoteFromProposal } : null,
        secondary: [{ label: 'Open proposal', run: toProposal }],
      }
    }
    if (!openQuote) {
      return {
        text: quotations.length
          ? 'No quotation is open. Prepare a new option for the customer.'
          : 'Start by preparing a quotation: pick what you are offering and the price.',
        primary: canAddQuotation ? { label: 'Create quotation', run: startNewQuotation } : null,
      }
    }
    const texts = {
      draft: 'is a draft. Check the items and price, preview the PDF, then send it.',
      pending_approval: canApprove ? 'is waiting for your approval.' : 'is waiting for a manager to approve the discount.',
      approved: 'is approved. Send it to the customer.',
      sent: 'is with the customer. Record their answer when you hear back.',
      changes_requested: 'is under discussion: the customer asked for changes. Revise it and send it again.',
    }
    const preferred = {
      draft: ['email', 'send'],
      pending_approval: ['approve'],
      approved: ['email', 'send'],
      sent: ['accept', 'changes', 'reject'],
      changes_requested: ['revise'],
    }[openQuote.status] || []
    const available = actionsFor(openQuote)
    const ordered = preferred.map((key) => available.find((a) => a.key === key)).filter(Boolean)
    const toButton = (a) => ({ label: a.label, danger: a.danger, run: () => pickQuotationAction(openQuote, a) })
    return {
      text: `${quoteName(openQuote)} ${texts[openQuote.status] || 'needs your attention.'}`,
      primary: ordered[0] ? toButton(ordered[0]) : null,
      secondary: [
        ...ordered.slice(1).map(toButton),
        { label: 'Open quotation', run: () => navigate(`/quotations/${openQuote.id}`) },
      ],
    }
  }
  const next = nextStep()

  const showProposal = Boolean(opp.lead_id) || proposals.length > 0
  const tabs = [
    showProposal && { key: 'proposal', label: proposal ? `Proposal · v${proposal.version_no}` : 'Proposal' },
    { key: 'quotations', label: `Quotations${quotations.length ? ` (${quotations.length})` : ''}` },
    canSeeContracts && { key: 'contract', label: `Contract${contracts.length ? ` (${contracts.length})` : ''}` },
    canSeeFiles && { key: 'files', label: 'Files' },
    canSeeActivity && { key: 'activity', label: 'Activity' },
  ].filter(Boolean)
  const stepTab = needsProposal || (acceptedProposal && quotations.length === 0) ? 'proposal' : 'quotations'
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs.some((t) => t.key === stepTab) ? stepTab : 'quotations'

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
          </p>
        </div>
        <div className="row-actions" style={{ margin: 0 }}>
          {canManage && open && panel !== 'lost' && (
            <button type="button" className="btn danger-outline" onClick={() => setPanel('lost')}>Mark lost…</button>
          )}
          <button className="btn secondary" onClick={() => navigate('/opportunities')}>← Back</button>
        </div>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {!error && <ErrorBanner error={loadError} onRetry={reload} />}

      <section className="journey deal-flow" aria-label="Deal progress">
        <DealStepper steps={steps} />
        <div className={`deal-next${next.tone ? ` is-${next.tone}` : ''}`}>
          <div className="deal-next-body">
            <span className="journey-next-label">
              {next.tone === 'done' ? 'Done' : next.tone === 'lost' ? 'Status' : 'Next step'}
            </span>
            <p className="deal-next-text">{next.text}</p>
          </div>
          {(next.primary || next.secondary?.length > 0) && (
            <div className="deal-next-actions">
              {next.secondary?.map((b) => (
                <button key={b.label} type="button" className="btn secondary" onClick={b.run} disabled={saving}>
                  {b.label}
                </button>
              ))}
              {next.primary && (
                <button type="button" className={`btn${next.primary.danger ? ' danger' : ''}`} onClick={next.primary.run} disabled={saving}>
                  {next.primary.label}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {panel === 'lost' && (
        <form className="panel" onSubmit={markLost}>
          <h3 style={{ marginTop: 0 }}>Mark this proposal lost</h3>
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

      <div className="panel">
        <div className="section-head">
          <h2 style={{ fontSize: 17 }}>Summary</h2>
          {canManage && open && !editing && (
            <button type="button" className="btn secondary small-btn" onClick={() => setEditing(true)}>Edit details</button>
          )}
        </div>
        {editing ? (
          <form onSubmit={handleSave}>
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
                {mainQuote && <span className="muted small">The main quotation sets this when it changes.</span>}
              </div>
              <div className="field">
                <label htmlFor="opp-prob">Chance of winning %</label>
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
                <label htmlFor="opp-close">Expected to close by</label>
                <input
                  id="opp-close"
                  type="date"
                  value={form.expected_close_date}
                  onChange={(e) => set('expected_close_date', e.target.value)}
                />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button
                type="button"
                className="btn secondary"
                disabled={saving}
                onClick={() => {
                  rebase(opp)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="details-grid">
            <Detail label="Expected value">
              {formatMoney(opp.expected_value)}
              {mainQuote && (
                <div className="muted small">
                  from <Link to={`/quotations/${mainQuote.id}`}>{mainQuote.quote_no}</Link>
                </div>
              )}
            </Detail>
            <Detail label="Chance of winning">{opp.probability}%</Detail>
            <Detail label="Expected to close by">{formatDate(opp.expected_close_date)}</Detail>
            <Detail label="Owner">{ownerName(opp.owner.id)}</Detail>
            {opp.lost_reason && <Detail label="Lost because">{opp.lost_reason}</Detail>}
          </div>
        )}
      </div>

      <div className="tab-bar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            className={activeTab === t.key ? 'active' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'proposal' && (
        <div className="panel">
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 17 }}>Proposal</h2>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                What you will do for the customer, as a PDF they can read. Once they accept it, the quotation is made from it.
              </p>
            </div>
          </div>
          <ProposalsSection
            orgId={orgId}
            opportunity={opp}
            canManage={canManage}
            onChanged={() => {
              proposalsQuery.reload()
              oppQuery.reload()
              invalidate(['opportunities', orgId])
              setTimelineKey((k) => k + 1)
            }}
          />
        </div>
      )}

      {activeTab === 'quotations' && (
        <div className="panel">
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 17 }}>Quotations</h2>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                You can offer several options. The ★ main one sets the expected value; accepting one closes the others.
              </p>
            </div>
            {canAddQuotation && panel !== 'quotation' && (
              <button className="btn small-btn" onClick={startNewQuotation}>+ New quotation</button>
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
            panel !== 'quotation' && (
              <div className="empty-note">
                <p style={{ margin: '0 0 10px' }}>No quotations yet. A quotation lists what you offer and the price.</p>
                {needsProposal && (
                  <p className="muted small">This deal came from a lead: the quotation is made from the proposal once the customer accepts it.</p>
                )}
                {canAddQuotation && (
                  <button className="btn" onClick={startNewQuotation}>Create the first quotation</button>
                )}
              </div>
            )
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
                        actions={actionsFor(q)}
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
      )}

      {activeTab === 'contract' && (
        <div className="panel">
          <div className="section-head">
            <h2 style={{ fontSize: 17 }}>Contract</h2>
            {canCreateContract && panel !== 'contract' && (
              <button className="btn small-btn" onClick={() => setPanel('contract')}>Create contract</button>
            )}
          </div>
          {panel === 'contract' && accepted && (
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
            panel !== 'contract' && (
              <p className="muted small" style={{ margin: 0 }}>
                {accepted
                  ? 'The quotation was accepted. Create the contract next.'
                  : 'The contract comes after the customer accepts a quotation.'}
              </p>
            )
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
                {canManageContracts && CONTRACT_EMAILABLE.includes(c.status) && emailingContract?.id !== c.id && (
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

      {activeTab === 'files' && canSeeFiles && (
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

      {activeTab === 'activity' && canSeeActivity && (
        <ActivityTimeline key={timelineKey} orgId={orgId} subjectType={SUBJECTS.opportunity} subjectId={opp.id} />
      )}
    </div>
  )
}
