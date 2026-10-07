import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import TaskFieldInputs from '@/features/delivery/components/TaskFieldInputs.jsx'
import { OUTCOME_KINDS, attributeErrors, checkFields, toAttributes, toFormValues } from '@/features/delivery/taskFields.js'
import { formatDateTime } from '@/features/delivery/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The forms a task's steps need, shared by the task page, the board and the queue.
// Each takes `busy`, `error`, `onCancel` and calls `onSubmit(body)` with the request body.

export function ReasonForm({ label, action, busy, error, onCancel, onSubmit, withSlaPause = false }) {
  const [reason, setReason] = useState('')
  const [pauseSla, setPauseSla] = useState(false)
  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ reason: reason.trim(), ...(withSlaPause && pauseSla ? { pause_sla: true } : {}) })
      }}
    >
      <ErrorBanner error={error} />
      <div className="field">
        <label htmlFor="action_reason">{label}</label>
        <input id="action_reason" required autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {withSlaPause && (
        <label className="inline-check" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={pauseSla} onChange={(e) => setPauseSla(e.target.checked)} />
          Waiting on the client: pause the SLA clock until it's unblocked
        </label>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{action}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}

// Submitting: how it went (the type's outcomes), the fields it needs before submitting, a
// note, and when to follow up. An outcome that schedules a follow-up proposes its date.
export function SubmitForm({ task, taskType, fields, busy, error, onCancel, onSubmit }) {
  const outcomes = taskType?.outcomes ?? []
  const submitFields = fields.filter((f) => f.required_on_submit || (!f.custom && !f.required))
  const [outcome, setOutcome] = useState('')
  const [values, setValues] = useState(() => toFormValues(submitFields, task.attributes))
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [skipFollowUp, setSkipFollowUp] = useState(false)
  const [problems, setProblems] = useState({})
  const serverProblems = attributeErrors(error)
  const fieldErrors = { ...serverProblems, ...problems }
  const chosen = outcomes.find((o) => o.code === outcome)
  const proposedFollowUp = chosen?.follow_up_in_days != null ? addDays(chosen.follow_up_in_days) : ''

  function handleSubmit(e) {
    e.preventDefault()
    const found = checkFields(submitFields, values, 'submit')
    if (outcomes.length && !outcome) found.outcome = 'Choose how it went.'
    setProblems(found)
    if (Object.keys(found).length) return
    const attributes = toAttributes(submitFields, values)
    const body = { ...(note.trim() ? { note: note.trim() } : {}), ...(outcome ? { outcome } : {}) }
    if (Object.keys(attributes).length) body.attributes = attributes
    if (skipFollowUp) body.skip_follow_up = true
    else if (followUp) body.follow_up_at = new Date(`${followUp}T09:00:00`).toISOString()
    onSubmit(body)
  }

  return (
    <form style={{ marginTop: 14 }} onSubmit={handleSubmit}>
      {error && Object.keys(serverProblems).length === 0 && <ErrorBanner error={error} />}
      {outcomes.length > 0 && (
        <div className="field">
          <label>How did it go? *</label>
          <div className="outcome-picker" role="radiogroup">
            {outcomes.map((o) => (
              <button
                key={o.code}
                type="button"
                role="radio"
                aria-checked={outcome === o.code}
                className={`outcome ${o.kind}${outcome === o.code ? ' chosen' : ''}`}
                title={OUTCOME_KINDS[o.kind]}
                onClick={() => {
                  setOutcome(o.code)
                  setFollowUp('')
                }}
              >
                {o.label}
                {o.follow_up_in_days != null && <span className="muted small"> · next in {o.follow_up_in_days}d</span>}
              </button>
            ))}
          </div>
          {fieldErrors.outcome && <div className="field-error">{fieldErrors.outcome}</div>}
        </div>
      )}
      <TaskFieldInputs fields={submitFields} values={values} onChange={setValues} errors={fieldErrors} stage="submit" idPrefix="submit" />
      <div className="field">
        <label htmlFor="submit_note">Note</label>
        <input id="submit_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done, anything to know" />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="follow_up">Follow up on</label>
          <input
            id="follow_up"
            type="date"
            disabled={skipFollowUp}
            value={followUp || proposedFollowUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
          <div className="hint">
            {proposedFollowUp && !followUp ? 'Proposed by the outcome. ' : ''}Creates the next task for the same person.
          </div>
        </div>
        <div className="field" style={{ alignSelf: 'center' }}>
          <label className="inline-check">
            <input type="checkbox" checked={skipFollowUp} onChange={(e) => setSkipFollowUp(e.target.checked)} />
            No follow-up
          </label>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {taskType?.requires_review ? 'Submit for review' : 'Complete'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Reviewing: the earlier rounds and what they asked for, then this round's decision. Past the
// rounds the work includes (an agency's revision rounds), the reviewer is told before sending back.
export function ReviewForm({ orgId, task, taskType, names, busy, error, onCancel, onSubmit, initialResult = 'pass' }) {
  const { data: rounds = [] } = useQuery(['task', orgId, task.id, 'reviews'], ({ signal }) => tasksApi.reviews(orgId, task.id, { signal }), {
    enabled: Boolean(orgId),
  })
  const [result, setResult] = useState(initialResult)
  const [rating, setRating] = useState('')
  const [feedback, setFeedback] = useState('')
  const included = taskType?.review_rounds_included
  const thisRound = rounds.length + 1
  const beyondIncluded = included && result === 'fail' && thisRound >= included

  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ result, ...(rating ? { rating: Number(rating) } : {}), ...(feedback.trim() ? { feedback: feedback.trim() } : {}) })
      }}
    >
      <ErrorBanner error={error} />
      <p className="muted small" style={{ marginTop: 0 }}>
        Round {thisRound}{included ? ` of ${included} included` : ''}
        {task.attributes?.pull_request_url && <> · <a href={task.attributes.pull_request_url} target="_blank" rel="noreferrer">Open the pull request</a></>}
        {task.attributes?.asset_url && <> · <a href={task.attributes.asset_url} target="_blank" rel="noreferrer">Open the asset</a></>}
      </p>
      {rounds.length > 0 && (
        <div className="review-rounds">
          {rounds.map((r) => (
            <div key={r.id} className="small">
              <strong>Round {r.round}</strong> · {r.result === 'pass' ? 'approved' : 'sent back'} by {names.personName(r.reviewer)}{' '}
              <span className="muted">{formatDateTime(r.reviewed_at)}</span>
              {r.feedback && <div className="muted">“{r.feedback}”</div>}
            </div>
          ))}
        </div>
      )}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="review_result">Decision</label>
          <select id="review_result" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="pass">Approve: the task is done</option>
            <option value="fail">Send back for rework</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="review_rating">Rating</label>
          <select id="review_rating" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {beyondIncluded && (
        <div className="alert warn">
          The next round goes past the {included} included. Agree any extra rounds with the client before sending it back.
        </div>
      )}
      <div className="field">
        <label htmlFor="review_feedback">What needs to change{result === 'fail' ? ' *' : ''}</label>
        <textarea
          id="review_feedback"
          rows={3}
          required={result === 'fail'}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={result === 'fail' ? 'Be specific: what to change and why' : 'Optional'}
        />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{result === 'pass' ? 'Approve' : 'Send back'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}
