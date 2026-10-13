import { useEffect, useRef, useState } from 'react'
import { quotationsApi } from '@/features/sales/api.js'
import { WITHDRAWAL_REASONS } from '@/features/sales/utils.js'
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
}

const BY_STATUS = {
  draft: ['open', 'submit', 'email', 'withdraw'],
  pending_approval: ['approve', 'withdraw'],
  approved: ['email', 'send', 'withdraw'],
  sent: ['emailAgain', 'accept', 'changes', 'reject', 'revise', 'validity', 'withdraw'],
  changes_requested: ['revise', 'emailAgain', 'reject', 'validity', 'withdraw'],
  accepted: ['contract', 'emailAgain'],
}

/**
 * The actions this person may take on the quotation now: [{ key, label, kind, danger }].
 * `canManage`: revenue.opportunity.write; `canApprove`: revenue.quotation.approve;
 * `canCreateContract`: may create one and none exists yet.
 */
export function quotationActions(quote, { canManage, canApprove, canCreateContract = false }) {
  return (BY_STATUS[quote.status] || [])
    .filter((key) => {
      if (key === 'approve') return canApprove
      if (key === 'contract') return canCreateContract
      return canManage
    })
    .map((key) => ({ key, ...ACTIONS[key] }))
}

// The 'run' actions. Revise answers with the new revision, the others with this quotation.
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

const FORM_TITLES = {
  accept: 'Customer accepted',
  changes: 'Customer asked for changes',
  reject: 'Customer rejected',
  validity: 'Extend validity',
  withdraw: 'Withdraw quotation',
}

/** The small form a '…' action opens: a confirmation, a note, a reason or a date. */
export function QuotationActionForm({ orgId, quote, action, onDone, onCancel }) {
  const today = todayIso()
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
          {action === 'accept' ? 'Mark accepted' : action === 'withdraw' ? 'Withdraw' : action === 'reject' ? 'Record rejection' : 'Save'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
