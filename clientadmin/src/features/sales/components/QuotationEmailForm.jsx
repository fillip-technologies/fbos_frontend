import { useState } from 'react'
import { quotationsApi } from '@/features/sales/api.js'
import { documentsApi, DOCUMENT_SUBJECTS, formatFileSize } from '@/features/documents/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// Loose on purpose: the mail server is the real judge, this only catches typing slips.
const EMAIL = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/
const LISTS = [
  ['to', 'To'],
  ['cc', 'Cc'],
  ['bcc', 'Bcc'],
]
const same = (a, b) => a.toLowerCase() === b.toLowerCase()

// Chosen addresses as removable chips, plus a box to type more (Enter, comma or leaving the box adds them).
function RecipientField({ id, label, values, onAdd, onRemove, required, serverError }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(null)

  function commit() {
    const parts = text.split(/[\s,;]+/).filter(Boolean)
    if (!parts.length) return
    const bad = parts.filter((p) => !EMAIL.test(p))
    parts.filter((p) => EMAIL.test(p)).forEach(onAdd)
    setText(bad.join(', '))
    setInvalid(bad.length ? `${bad.join(', ')} ${bad.length > 1 ? 'are not email addresses' : 'is not an email address'}` : null)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && ' *'}</label>
      <div className="recipient-box">
        {values.map((address) => (
          <span key={address} className="recipient-chip">
            {address}
            <button type="button" aria-label={`Remove ${address}`} onClick={() => onRemove(address)}>×</button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          placeholder={values.length ? 'Add another…' : 'Type an email address'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Backspace' && !text && values.length) {
              onRemove(values[values.length - 1])
            }
          }}
        />
      </div>
      {(invalid || serverError) && <div className="field-error">{invalid || serverError}</div>}
    </div>
  )
}

function Form({ orgId, quote, draft, files, canSeeFiles, onSent, onCancel }) {
  const [recipients, setRecipients] = useState({ to: draft.to, cc: [], bcc: [] })
  const [subject, setSubject] = useState(draft.subject)
  const [message, setMessage] = useState(draft.message)
  const [chosen, setChosen] = useState(() => new Set(files.map((d) => d.id)))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  // An address sits in one list at most: adding it to Cc takes it out of To.
  function put(list, address) {
    setRecipients((r) => {
      const next = { to: [], cc: [], bcc: [] }
      for (const [key] of LISTS) next[key] = r[key].filter((a) => !same(a, address))
      next[list] = [...next[list], address]
      return next
    })
  }
  const remove = (list, address) => setRecipients((r) => ({ ...r, [list]: r[list].filter((a) => !same(a, address)) }))
  const listOf = (address) => LISTS.find(([key]) => recipients[key].some((a) => same(a, address)))?.[0]

  const toggleFile = (id) =>
    setChosen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const chosenFiles = files.filter((d) => chosen.has(d.id))
  const totalBytes = chosenFiles.reduce((sum, d) => sum + (d.current_version?.size_bytes || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const sent = await quotationsApi.email(orgId, quote, {
        ...recipients,
        subject: subject.trim(),
        message,
        document_ids: chosenFiles.map((d) => d.id),
      })
      onSent(sent)
    } catch (err) {
      setError(err)
      setSending(false)
    }
  }

  const from = draft.sender.address ? `${draft.sender.name} <${draft.sender.address}>` : null

  return (
    <form onSubmit={handleSubmit}>
      <ErrorBanner error={error} />
      {!draft.sender.enabled && (
        <div className="alert warn">Email sending isn't set up on this server, so this email can't go out yet.</div>
      )}

      <div className="field">
        <div className="detail-label">From</div>
        <div className="detail-value">{from || <span className="muted">Not set up</span>}</div>
      </div>

      {draft.contacts.length > 0 && (
        <div className="field">
          <div className="detail-label">Customer contacts</div>
          <table className="contact-picker">
            <tbody>
              {draft.contacts.map((c) => {
                const inList = listOf(c.email)
                return (
                  <tr key={c.email} style={{ cursor: 'default' }}>
                    <td>
                      {c.name} {c.is_primary && <span className="chip subtle">Primary</span>}
                      {c.designation && <div className="muted small">{c.designation}</div>}
                    </td>
                    <td className="mono small">{c.email}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="segmented" role="group" aria-label={`Send to ${c.name} as`}>
                        {LISTS.map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            className={inList === key ? 'active' : ''}
                            aria-pressed={inList === key}
                            onClick={() => (inList === key ? remove(key, c.email) : put(key, c.email))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {LISTS.map(([key, label]) => (
        <RecipientField
          key={key}
          id={`q-email-${key}`}
          label={label}
          required={key === 'to'}
          values={recipients[key]}
          onAdd={(address) => put(key, address)}
          onRemove={(address) => remove(key, address)}
          serverError={fieldErrors[key]}
        />
      ))}

      <div className="field">
        <label htmlFor="q-email-subject">Subject *</label>
        <input id="q-email-subject" required maxLength={255} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="q-email-message">Message *</label>
        <textarea id="q-email-message" required rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      {canSeeFiles && (
        <div className="field">
          <div className="detail-label">Files to attach</div>
          {files.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No files are attached to this quotation.</p>
          ) : (
            files.map((d) => (
              <label key={d.id} className="file-choice">
                <input type="checkbox" checked={chosen.has(d.id)} onChange={() => toggleFile(d.id)} />
                <span>{d.title || d.current_version?.file_name}</span>
                <span className="muted small">
                  {d.current_version?.file_name} · {formatFileSize(d.current_version?.size_bytes)}
                </span>
              </label>
            ))
          )}
        </div>
      )}

      <div className="alert info" aria-live="polite">
        <div>
          <b>Sending from:</b> {from || '—'}
        </div>
        <div>
          <b>To:</b> {recipients.to.join(', ') || <span className="muted">nobody yet</span>}
        </div>
        {recipients.cc.length > 0 && <div><b>Cc:</b> {recipients.cc.join(', ')}</div>}
        {recipients.bcc.length > 0 && <div><b>Bcc:</b> {recipients.bcc.join(', ')}</div>}
        <div>
          <b>Files:</b>{' '}
          {chosenFiles.length
            ? `${chosenFiles.map((d) => d.current_version?.file_name).join(', ')} (${formatFileSize(totalBytes)})`
            : 'none'}
        </div>
        {draft.marks_sent && <div style={{ marginTop: 6 }}>Sending also marks this quotation as sent, so its lines can't be changed afterwards.</div>}
      </div>

      <div className="row-actions">
        <button
          className="btn"
          type="submit"
          disabled={sending || !draft.sender.enabled || recipients.to.length === 0}
          aria-busy={sending}
        >
          {sending ? 'Sending…' : 'Send email'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={sending}>Cancel</button>
      </div>
    </form>
  )
}

// Email a quotation, with the files chosen from it, to the customer.
export default function QuotationEmailForm({ orgId, quote, canSeeFiles, onSent, onCancel }) {
  const draftQuery = useQuery(['quotation-email-draft', orgId, quote.id], ({ signal }) =>
    quotationsApi.emailDraft(orgId, quote.id, { signal }), { staleTime: 0 }
  )
  // Same key as the quotation's DocumentPanel, so both share one request.
  const filesQuery = useQuery(
    ['documents', orgId, DOCUMENT_SUBJECTS.quotation, quote.id],
    ({ signal }) => documentsApi.listForSubject(orgId, DOCUMENT_SUBJECTS.quotation, quote.id, { signal }),
    { enabled: canSeeFiles },
  )
  const draft = draftQuery.data
  const files = (filesQuery.data?.data ?? []).filter((d) => d.current_version)
  const loading = draftQuery.loading || (canSeeFiles && filesQuery.loading)

  return (
    <div className="inline-panel">
      <h3>Email quotation · {quote.quote_no} rev {quote.revision_no}</h3>
      <ErrorBanner error={draftQuery.error || filesQuery.error} onRetry={() => { draftQuery.reload(); filesQuery.reload() }} />
      {loading ? (
        <PanelSkeleton />
      ) : draft && !draft.emailable ? (
        <>
          <p className="muted small">
            This quotation can't be emailed while it is {quote.status.replaceAll('_', ' ')}. Only a draft, approved, sent or
            accepted quotation goes to the customer.
          </p>
          <button type="button" className="btn secondary" onClick={onCancel}>Close</button>
        </>
      ) : (
        draft && (
          <Form
            orgId={orgId}
            quote={quote}
            draft={draft}
            files={files}
            canSeeFiles={canSeeFiles}
            onSent={onSent}
            onCancel={onCancel}
          />
        )
      )}
    </div>
  )
}
