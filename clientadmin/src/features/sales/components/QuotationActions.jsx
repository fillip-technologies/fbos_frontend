import { useEffect, useRef, useState } from 'react'
import { opportunitiesApi, quotationsApi } from '@/features/sales/api.js'
import { OPEN_QUOTATION_STATUSES, WITHDRAWAL_REASONS, quotationTitle } from '@/features/sales/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { toIsoDate, todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

// What can be done with a quotation, by status. Shared by the opportunity page (a menu per
// row) and the quotation page (buttons), so both offer the same steps.
//
// kind: 'run' acts at once (performQuotationAction), 'form' opens QuotationActionForm,
// 'page' is for the page to handle (open the quotation, the email form, the contract form).
const ACTIONS = {
  open: { label: 'Edit', kind: 'page' },
  submit: { label: 'Submit', kind: 'run' },
  approve: { label: 'Approve discount', kind: 'run' },
  email: { label: 'Email to customer', kind: 'page' },
  emailAgain: { label: 'Email again', kind: 'page' },
  send: { label: 'Mark as sent', kind: 'run' },
  accept: { label: 'Mark accepted…', kind: 'form' },
  changes: { label: 'Changes requested…', kind: 'form' },
  reject: { label: 'Mark rejected…', kind: 'form', danger: true },
  revise: { label: 'Revise', kind: 'run' },
  validity: { label: 'Extend validity…', kind: 'form' },
  withdraw: { label: 'Withdraw…', kind: 'form', danger: true },
  contract: { label: 'Create contract', kind: 'page' },
  makeMain: { label: 'Make main quotation', kind: 'run' },
  rename: { label: 'Rename…', kind: 'form' },
  duplicate: { label: 'Duplicate as new option…', kind: 'form' },
}

const BY_STATUS = {
  draft: ['open', 'submit', 'email', 'makeMain', 'rename', 'duplicate', 'withdraw'],
  pending_approval: ['approve', 'makeMain', 'rename', 'withdraw'],
  approved: ['email', 'send', 'makeMain', 'rename', 'duplicate', 'withdraw'],
  sent: ['emailAgain', 'accept', 'changes', 'reject', 'revise', 'validity', 'makeMain', 'rename', 'duplicate', 'withdraw'],
  changes_requested: ['revise', 'emailAgain', 'reject', 'validity', 'makeMain', 'rename', 'withdraw'],
  accepted: ['contract', 'emailAgain', 'rename', 'duplicate'],
  rejected: ['duplicate'],
  withdrawn: ['duplicate'],
  not_chosen: ['duplicate'],
  superseded: ['duplicate'],
}

/**
 * The actions this person may take on the quotation now: [{ key, label, kind, danger }].
 * `canManage`: revenue.opportunity.write; `canApprove`: revenue.quotation.approve;
 * `canCreateContract`: may create one and none exists yet; `opportunityOpen`: new options may
 * be added (duplicates).
 */
export function quotationActions(quote, { canManage, canApprove, canCreateContract = false, opportunityOpen = false }) {
  return (BY_STATUS[quote.status] || [])
    .filter((key) => {
      if (key === 'approve') return canApprove
      if (key === 'contract') return canCreateContract
      if (key === 'makeMain') return canManage && !quote.is_main && Boolean(quote.opportunity_id)
      if (key === 'duplicate') return canManage && opportunityOpen && Boolean(quote.opportunity_id)
      return canManage
    })
    .map((key) => ({ key, ...ACTIONS[key] }))
}

// The 'run' actions. Revise answers with the new revision, the others with this quotation.
// (Making one main changes the others too: reload the opportunity's list after it.)
export function performQuotationAction(orgId, quote, key) {
  switch (key) {
    case 'submit':
      return quotationsApi.submit(orgId, quote)
    case 'approve':
      return quotationsApi.approve(orgId, quote)
    case 'send':
      return quotationsApi.send(orgId, quote)
    case 'revise':
      return quotationsApi.revise(orgId, quote)
    case 'makeMain':
      return quotationsApi.update(orgId, quote, { is_main: true })
    default:
      throw new Error(`Not an immediate quotation action: ${key}`)
  }
}

export const quotationLabel = (q) => `${q.quote_no} rev ${q.revision_no}`

/** "Actions ▾" with the quotation's actions; it lives inside a clickable row, so clicks stay here. */
export function QuotationActionMenu({ actions, onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!actions.length) return null
  return (
    <div className="action-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn secondary small-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        Actions ▾
      </button>
      {open && (
        <div className="action-menu-list" role="menu">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              className={a.danger ? 'danger' : undefined}
              onClick={() => {
                setOpen(false)
                onPick(a)
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function inDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

const SUBMIT_LABELS = {
  accept: 'Mark accepted',
  withdraw: 'Withdraw',
  reject: 'Record rejection',
  duplicate: 'Create draft',
}

const FORM_TITLES = {
  accept: 'Customer accepted',
  changes: 'Customer asked for changes',
  reject: 'Customer rejected',
  validity: 'Extend validity',
  withdraw: 'Withdraw quotation',
  rename: 'Rename',
  duplicate: 'Duplicate as new option',
}

/**
 * The small form a '…' action opens: a confirmation, a note, a reason, a name or a date.
 * `onDone` gets the saved quotation, which for a duplicate is the new one.
 */
export function QuotationActionForm({ orgId, quote, action, onDone, onCancel }) {
  const today = todayIso()
  // Accepting closes the opportunity's other open options: list them (shared with the opportunity page).
  const { data: siblings } = useQuery(
    ['quotations', orgId, { opportunity: quote.opportunity_id }],
    ({ signal }) => opportunitiesApi.quotations(orgId, quote.opportunity_id, { signal }),
    { enabled: action === 'accept' && Boolean(quote.opportunity_id) }
  )
  const closing = (siblings?.data ?? []).filter((q) => q.id !== quote.id && OPEN_QUOTATION_STATUSES.includes(q.status))
  const [name, setName] = useState(action === 'duplicate' ? `${quotationTitle(quote)} (copy)` : quote.name || '')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('mistake')
  const [validUntil, setValidUntil] = useState(quote.valid_until && quote.valid_until >= today ? quote.valid_until : inDays(30))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function save() {
    switch (action) {
      case 'accept':
        return quotationsApi.accept(orgId, quote)
      case 'changes':
        return quotationsApi.requestChanges(orgId, quote, { note: note.trim() })
      case 'reject':
        return quotationsApi.reject(orgId, quote, { reason: note.trim() })
      case 'validity':
        return quotationsApi.setValidity(orgId, quote, validUntil)
      case 'withdraw':
        return quotationsApi.withdraw(orgId, quote, note.trim() ? { reason, note: note.trim() } : { reason })
      case 'rename':
        return quotationsApi.update(orgId, quote, { name: name.trim() })
      case 'duplicate':
        return opportunitiesApi.createQuotation(orgId, quote.opportunity_id, {
          copy_from: quote.id,
          name: name.trim() || undefined,
          valid_until: validUntil,
        })
      default:
        throw new Error(`Not a quotation form: ${action}`)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      onDone(await save())
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const danger = action === 'reject' || action === 'withdraw'
  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>
        {FORM_TITLES[action]} · <span className="mono">{quotationLabel(quote)}</span>
      </h3>
      <ErrorBanner error={error} />

      {action === 'accept' && (
        <>
          <p className="small" style={{ marginTop: 0 }}>
            The opportunity will be marked won, and the customer becomes active if it is still a prospect.
          </p>
          {closing.length > 0 && (
            <div className="alert warning small">
              {closing.length === 1 ? 'This other option' : 'These other options'} will be closed as not chosen:{' '}
              {closing.map((q) => quotationTitle(q)).join(', ')}.
            </div>
          )}
          {quote.is_expired && (
            <div className="alert warning small">
              This quotation was valid until {formatDate(quote.valid_until)}. Make sure the customer accepted it as quoted.
            </div>
          )}
        </>
      )}

      {action === 'changes' && (
        <div className="field">
          <label htmlFor="qa-note">What did the customer ask to change? *</label>
          <textarea id="qa-note" rows={3} required maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="muted small" style={{ margin: '4px 0 0' }}>Revise the quotation next to answer them.</p>
        </div>
      )}

      {action === 'reject' && (
        <div className="field">
          <label htmlFor="qa-reason">Why did the customer reject it? *</label>
          <input id="qa-reason" required maxLength={512} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      {(action === 'rename' || action === 'duplicate') && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="qa-name">Option name</label>
            <input
              id="qa-name"
              maxLength={120}
              placeholder="e.g. Option B – Premium"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {action === 'duplicate' && (
            <div className="field">
              <label htmlFor="qa-copy-valid">Valid until *</label>
              <input id="qa-copy-valid" type="date" required min={today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          )}
        </div>
      )}
      {action === 'duplicate' && (
        <p className="muted small" style={{ marginTop: 0 }}>
          A new draft with the same lines (taxed again as of today), terms and files.
        </p>
      )}

      {action === 'validity' && (
        <div className="field" style={{ maxWidth: 240 }}>
          <label htmlFor="qa-valid">Valid until *</label>
          <input id="qa-valid" type="date" required min={today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          <p className="muted small" style={{ margin: '4px 0 0' }}>Now: {formatDate(quote.valid_until)}</p>
        </div>
      )}

      {action === 'withdraw' && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="qa-wreason">Reason *</label>
            <select id="qa-wreason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(WITHDRAWAL_REASONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="qa-wnote">Note</label>
            <input id="qa-wnote" maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      <div className="row-actions">
        <button className={danger ? 'btn danger' : 'btn'} type="submit" disabled={busy} aria-busy={busy}>
          {SUBMIT_LABELS[action] || 'Save'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
