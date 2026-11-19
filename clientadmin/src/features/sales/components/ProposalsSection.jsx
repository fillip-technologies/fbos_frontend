import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { offeringsApi, proposalsApi } from '@/features/sales/api.js'
import useOwners from '@/features/customers/useOwners.js'
import { formatMoney } from '@/features/customers/utils.js'
import CustomerEmailForm, { proposalEmailProps } from '@/features/sales/components/CustomerEmailForm.jsx'
import PdfButton from '@/features/sales/components/PdfButton.jsx'
import QuotationItemsEditor, { itemToRow, newItem, rowsToItems } from '@/features/sales/components/QuotationItemsEditor.jsx'
import {
  OPEN_PROPOSAL_STATUSES,
  OPEN_STAGES,
  PROPOSAL_EVENT_LABELS,
  formatDateTime,
  proposalLabel,
  proposalStatusText,
} from '@/features/sales/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

// Revenue keeps moments in UTC without saying so.
const asUtc = (iso) => (iso && !/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? `${iso}Z` : iso)

const SECTIONS = [
  ['requirements', 'Requirements', 'What the customer needs. Starts from the requirements written down on the lead’s calls.'],
  ['scope', 'Scope of work', 'What we will do, and what is not included.'],
  ['timeline', 'Timeline', 'Phases and dates.'],
  ['terms', 'Terms', 'Payment, validity and other terms.'],
]

function Editor({ orgId, proposal, onSaved, onCancel }) {
  const { data: offerings = [] } = useLookup(['offerings-all', orgId], ({ signal }) => offeringsApi.listAll(orgId, { signal }))
  const [form, setForm] = useState(() => ({
    title: proposal.title,
    ...Object.fromEntries(SECTIONS.map(([key]) => [key, proposal[key] || ''])),
  }))
  const [rows, setRows] = useState(() => (proposal.items.length ? proposal.items.map(itemToRow) : [newItem()]))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const items = rowsToItems(rows.filter((r) => r.offering_id), offerings, { forProposal: true })
      onSaved(await proposalsApi.update(orgId, proposal, { ...form, title: form.title.trim(), items }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>Edit {proposalLabel(proposal)}</h3>
      {error && <ErrorBanner error={error} />}
      <div className="field">
        <label htmlFor="proposal-title">Title *</label>
        <input id="proposal-title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
        {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
      </div>
      {SECTIONS.map(([key, label, hint]) => (
        <div className="field" key={key}>
          <label htmlFor={`proposal-${key}`}>{label}</label>
          <textarea id={`proposal-${key}`} rows={key === 'terms' ? 3 : 4} value={form[key]} onChange={(e) => set(key, e.target.value)} />
          <div className="hint">{hint}</div>
        </div>
      ))}
      <div className="field">
        <div className="detail-label">Services and estimate</div>
        <QuotationItemsEditor rows={rows} setRows={setRows} offerings={offerings} forProposal />
        <div className="hint">Prices are before tax. The quotation made from the accepted proposal copies these lines and adds the taxes.</div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

// A note the customer gave (feedback, a reason to reject, words with a yes) or why we revise.
function NoteForm({ title, label, required, submitLabel, danger, onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit(text.trim())
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      {error && <ErrorBanner error={error} />}
      <div className="field">
        <label htmlFor="proposal-note">{label}{required ? ' *' : ''}</label>
        <textarea id="proposal-note" rows={3} required={required} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row-actions">
        <button className={`btn${danger ? ' danger' : ''}`} type="submit" disabled={saving} aria-busy={saving}>{submitLabel}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

function History({ orgId, proposal }) {
  const { ownerName } = useOwners(orgId)
  const { data: events, error, loading, reload } = useQuery(
    ['proposal-events', orgId, proposal.id, proposal.version],
    ({ signal }) => proposalsApi.events(orgId, proposal.id, { signal }),
  )
  if (loading) return <PanelSkeleton />
  if (error) return <ErrorBanner error={error} onRetry={reload} />
  return (
    <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
      {(events || []).map((e) => (
        <li key={e.id}>
          <strong>{PROPOSAL_EVENT_LABELS[e.event] || e.event}</strong>
          {e.actor_user_id && <> by {ownerName(e.actor_user_id)}</>} · {formatDateTime(asUtc(e.occurred_at))}
          {e.event === 'emailed' && e.data?.to && <span className="muted"> · to {e.data.to.join(', ')}</span>}
          {e.note && <div className="muted" style={{ whiteSpace: 'pre-line' }}>{e.note}</div>}
        </li>
      ))}
    </ul>
  )
}

function ProposalCard({ orgId, proposal, canManage, opportunityOpen, onChanged, onEmailed }) {
  const navigate = useNavigate()
  const [panel, setPanel] = useState(null) // edit | email | feedback | revise | accept | reject
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const status = proposal.status
  const awaiting = ['sent', 'under_discussion'].includes(status)

  // A form's action: its error shows in the form.
  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      const result = await action()
      setPanel(null)
      onChanged(result)
      return result
    } finally {
      setBusy(false)
    }
  }
  // A button's action: its error shows above the buttons.
  const act = (action) => run(action).catch(setError)

  async function makeQuotation() {
    try {
      const quote = await run(() => proposalsApi.quote(orgId, proposal))
      invalidate(['quotations', orgId])
      navigate(`/quotations/${quote.id}`)
    } catch (err) {
      setError(err)
    }
  }

  const buttons = []
  if (canManage && status === 'draft') {
    buttons.push(
      <button key="edit" className="btn small-btn" onClick={() => setPanel('edit')}>Edit</button>,
      <button key="email" className="btn small-btn" onClick={() => setPanel('email')}>Email to customer</button>,
      <button key="send" className="btn secondary small-btn" disabled={busy} onClick={() => act(() => proposalsApi.send(orgId, proposal))}>
        Mark as sent
      </button>,
    )
  }
  if (canManage && awaiting) {
    buttons.push(
      <button key="accept" className="btn small-btn" onClick={() => setPanel('accept')}>Accepted…</button>,
      <button key="feedback" className="btn secondary small-btn" onClick={() => setPanel('feedback')}>Customer feedback…</button>,
      <button key="revise" className="btn secondary small-btn" onClick={() => setPanel('revise')}>Revise…</button>,
      <button key="emailAgain" className="btn secondary small-btn" onClick={() => setPanel('email')}>Email again</button>,
      <button key="reject" className="btn danger-outline small-btn" onClick={() => setPanel('reject')}>Rejected…</button>,
    )
  }
  if (canManage && status === 'rejected' && opportunityOpen) {
    buttons.push(<button key="revise" className="btn small-btn" onClick={() => setPanel('revise')}>Revise…</button>)
  }
  if (status === 'accepted') {
    if (proposal.quotation_id) {
      buttons.push(
        <button key="quote" className="btn small-btn" onClick={() => navigate(`/quotations/${proposal.quotation_id}`)}>Open quotation</button>,
      )
    } else if (canManage && opportunityOpen) {
      buttons.push(
        <button key="quote" className="btn small-btn" disabled={busy} onClick={makeQuotation}>Create quotation</button>,
      )
    }
  }
  buttons.push(
    <PdfButton
      key="pdf"
      label={status === 'draft' ? 'Preview PDF' : 'View PDF'}
      load={() => proposalsApi.pdf(orgId, proposal.id)}
    />,
  )

  return (
    <div>
      <div className="section-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <strong>{proposal.title}</strong>{' '}
          <StatusBadge status={status} label={proposalStatusText(proposal)} />
          <div className="muted small">
            {proposalLabel(proposal)} · estimate {formatMoney(proposal.total)} before tax
            {proposal.sent_at && ` · sent ${formatDate(asUtc(proposal.sent_at))}`}
          </div>
        </div>
      </div>
      {proposal.revision_note && <p className="small" style={{ whiteSpace: 'pre-line' }}><strong>Why this version:</strong> {proposal.revision_note}</p>}
      {proposal.customer_feedback && status !== 'draft' && (
        <div className={`alert ${status === 'rejected' ? 'warn' : 'info'}`} style={{ whiteSpace: 'pre-line' }}>
          <strong>Customer:</strong> {proposal.customer_feedback}
        </div>
      )}
      {SECTIONS.filter(([key]) => proposal[key]).map(([key, label]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div className="detail-label">{label}</div>
          <div className="small" style={{ whiteSpace: 'pre-line' }}>{proposal[key]}</div>
        </div>
      ))}
      {proposal.items.length > 0 && (
        <table style={{ marginBottom: 8 }}>
          <thead>
            <tr><th>Service</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {proposal.items.map((i) => (
              <tr key={i.line_no} style={{ cursor: 'default' }}>
                <td>{i.offering_name}{i.description && i.description !== i.offering_name && <div className="muted small">{i.description}</div>}</td>
                <td style={{ textAlign: 'right' }}>{i.quantity} {i.unit}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(i.unit_price)}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {status === 'draft' && !proposal.scope && proposal.items.length === 0 && (
        <p className="muted small">Add the scope of work or the services before sending it.</p>
      )}

      {error && <ErrorBanner error={error} />}
      <div className="row-actions" style={{ flexWrap: 'wrap' }}>{buttons}</div>

      {panel === 'edit' && (
        <Editor orgId={orgId} proposal={proposal} onSaved={(saved) => { setPanel(null); onChanged(saved) }} onCancel={() => setPanel(null)} />
      )}
      {panel === 'email' && (
        <CustomerEmailForm
          orgId={orgId}
          {...proposalEmailProps(orgId, proposal)}
          canSeeFiles
          onSent={(sent) => { setPanel(null); onChanged(sent.proposal); onEmailed?.(sent) }}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'feedback' && (
        <NoteForm
          title="What did the customer say?" label="Their feedback" required submitLabel="Save feedback"
          onSubmit={(feedback) => run(() => proposalsApi.feedback(orgId, proposal, { feedback }))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'revise' && (
        <NoteForm
          title={`Revise into v${proposal.version_no + 1}`} label="What changes and why (blank: the customer's feedback)"
          submitLabel="Create new version"
          onSubmit={(note) => run(() => proposalsApi.revise(orgId, proposal, note ? { note } : {}))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'accept' && (
        <NoteForm
          title="The customer accepted the proposal" label="Anything they said" submitLabel="Mark accepted"
          onSubmit={(note) => run(() => proposalsApi.accept(orgId, proposal, note ? { note } : {}))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'reject' && (
        <NoteForm
          title="The customer rejected the proposal" label="Why" required danger submitLabel="Mark rejected"
          onSubmit={(reason) => run(() => proposalsApi.reject(orgId, proposal, { reason }))}
          onCancel={() => setPanel(null)}
        />
      )}

      <button type="button" className="link-btn small" onClick={() => setShowHistory((s) => !s)} style={{ marginTop: 8 }}>
        {showHistory ? 'Hide history' : 'Show history'}
      </button>
      {showHistory && <History orgId={orgId} proposal={proposal} />}
    </div>
  )
}

/**
 * The opportunity's proposal: what we propose before the priced quotation. Shown on the
 * opportunity page and on the lead page (the salesperson's workspace), from the same component.
 * `onChanged()` runs after anything changes (the stage and timeline may have moved).
 */
export default function ProposalsSection({ orgId, opportunity, canManage, onChanged }) {
  const listQuery = useQuery(
    ['proposals', orgId, opportunity.id],
    ({ signal }) => proposalsApi.list(orgId, opportunity.id, { signal }),
    { enabled: Boolean(orgId) },
  )
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  const proposals = listQuery.data?.data ?? []
  const current = proposals[0]
  const older = proposals.slice(1)
  const opportunityOpen = OPEN_STAGES.includes(opportunity.stage)
  const canStart = canManage && opportunityOpen && !proposals.some((p) => OPEN_PROPOSAL_STATUSES.includes(p.status))

  function changed() {
    invalidate(['proposals', orgId])
    listQuery.reload()
    onChanged?.()
  }

  async function start() {
    setError(null)
    setStarting(true)
    try {
      await proposalsApi.create(orgId, opportunity.id, {})
      changed()
    } catch (err) {
      setError(err)
    } finally {
      setStarting(false)
    }
  }

  if (listQuery.loading) return <PanelSkeleton />
  return (
    <div>
      {listQuery.error && <ErrorBanner error={listQuery.error} onRetry={listQuery.reload} />}
      {error && <ErrorBanner error={error} />}
      {!current ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            No proposal yet. Write down what you will do for {opportunity.client?.name || 'the customer'}: the requirements from
            your calls come in on their own. Once they accept it, the quotation is made from it.
          </p>
          {canStart && (
            <button className="btn" onClick={start} disabled={starting} aria-busy={starting}>Start proposal</button>
          )}
        </div>
      ) : (
        <>
          <ProposalCard
            key={`${current.id}-${current.version}`}
            orgId={orgId}
            proposal={current}
            canManage={canManage}
            opportunityOpen={opportunityOpen}
            onChanged={changed}
          />
          {canStart && (
            <button className="btn secondary small-btn" style={{ marginTop: 12 }} onClick={start} disabled={starting}>
              Start a new proposal
            </button>
          )}
        </>
      )}
      {older.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="detail-label">Earlier versions</div>
          <table>
            <tbody>
              {older.map((p) => (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td>{proposalLabel(p)} · {p.title}</td>
                  <td><StatusBadge status={p.status} label={proposalStatusText(p)} /></td>
                  <td className="muted small">{p.sent_at ? `sent ${formatDate(asUtc(p.sent_at))}` : 'not sent'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {p.status !== 'draft' && <PdfButton load={() => proposalsApi.pdf(orgId, p.id)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
