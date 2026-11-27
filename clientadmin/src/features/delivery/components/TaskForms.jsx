import '@/features/delivery/task-flow.css'
import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import CustomFieldInputs from '@/shared/components/CustomFieldInputs.jsx'
import { OUTCOME_KINDS, attributeErrors } from '@/features/delivery/taskFields.js'
import { checkFields, toAttributes, toFormValues } from '@/shared/utils/customFields.js'
import { formatDateTime } from '@/features/delivery/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import useTaskReviewers, { goesForReview as goesForReviewRule, isPersonalTask } from '@/features/delivery/useTaskReviewers.js'

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
// Your own task (no team) may name its reviewer here; one is needed when its kind goes for review.
export function SubmitForm({ orgId, task, taskType, fields, busy, error, onCancel, onSubmit }) {
  const outcomes = taskType?.outcomes ?? []
  const choosesReviewer = isPersonalTask(task) && !task.reviewer
  const reviewers = useTaskReviewers(orgId, choosesReviewer)
  const [reviewer, setReviewer] = useState('')
  const goesForReview = goesForReviewRule(task, taskType) || (choosesReviewer && Boolean(reviewer))
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
  const requiredLeft = (task.checklist ?? []).filter((i) => i.mandatory && !i.done).length
  const proposedFollowUp = chosen?.follow_up_in_days != null ? addDays(chosen.follow_up_in_days) : ''

  function handleSubmit(e) {
    e.preventDefault()
    const found = checkFields(submitFields, values, 'submit')
    if (outcomes.length && !outcome) found.outcome = 'Choose how it went.'
    if (choosesReviewer && taskType?.requires_review && !reviewer) found.reviewer_user_id = 'Choose who will review it.'
    setProblems(found)
    if (Object.keys(found).length) return
    const attributes = toAttributes(submitFields, values)
    const body = { ...(note.trim() ? { note: note.trim() } : {}), ...(outcome ? { outcome } : {}) }
    if (Object.keys(attributes).length) body.attributes = attributes
    if (skipFollowUp) body.skip_follow_up = true
    else if (followUp) body.follow_up_at = new Date(`${followUp}T09:00:00`).toISOString()
    if (choosesReviewer && reviewer) body.reviewer_user_id = reviewer
    onSubmit(body)
  }

  return (
    <form style={{ marginTop: 14 }} onSubmit={handleSubmit}>
      {error && Object.keys(serverProblems).length === 0 && <ErrorBanner error={error} />}
      <p className="tf-now" style={{ marginBottom: 12 }}>
        {goesForReview
          ? `You are handing this in. It goes to ${task.reviewer?.name || 'a reviewer'} to check, and you are told if it is sent back.`
          : 'You are finishing this task. It will be marked done.'}
      </p>
      {requiredLeft > 0 && (
        <div className="alert warn">
          {requiredLeft} required {requiredLeft === 1 ? 'step is' : 'steps are'} not ticked yet. Tick {requiredLeft === 1 ? 'it' : 'them'} in the checklist first, or this will be refused.
        </div>
      )}
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
      <CustomFieldInputs fields={submitFields} values={values} onChange={setValues} errors={fieldErrors} stage="submit" idPrefix="submit" />
      {choosesReviewer && (
        <div className="field">
          <label htmlFor="submit_reviewer">Reviewer{taskType?.requires_review ? ' *' : ''}</label>
          <select id="submit_reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
            <option value="">{taskType?.requires_review ? '— Choose —' : '— No review, it’s done —'}</option>
            {reviewers.people.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="hint">
            {taskType?.requires_review ? 'This kind of task goes for review: they check it and pass it or send it back.' : 'Optional: someone checks it before it counts as done.'}
          </div>
          {fieldErrors.reviewer_user_id && <div className="field-error">{fieldErrors.reviewer_user_id}</div>}
          {reviewers.error && <div className="hint">The company’s people couldn’t be loaded. Try again shortly.</div>}
        </div>
      )}
      {!choosesReviewer && isPersonalTask(task) && task.reviewer && (
        <p className="hint">Goes to {task.reviewer.name || 'your reviewer'} for review.</p>
      )}
      <div className="field">
        <label htmlFor="submit_note">What did you do? <span className="muted">(optional)</span></label>
        <input id="submit_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the person checking should know" />
      </div>
      <details className="tf-fold" open={Boolean(proposedFollowUp || followUp || skipFollowUp)}>
        <summary>Plan a follow-up task <small>(optional)</small></summary>
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
      </details>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
          {goesForReview ? 'Submit for review' : 'Complete'}
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
      <div className="field">
        <label>Your decision</label>
        <div className="rv-choice" role="radiogroup" aria-label="Your decision">
          <button type="button" role="radio" aria-checked={result === 'pass'} className={`rv-opt pass${result === 'pass' ? ' chosen' : ''}`} onClick={() => setResult('pass')}>
            <strong>✓ Approve</strong>
            <small>The work is good. The task is done.</small>
          </button>
          <button type="button" role="radio" aria-checked={result === 'fail'} className={`rv-opt fail${result === 'fail' ? ' chosen' : ''}`} onClick={() => setResult('fail')}>
            <strong>↩ Send back</strong>
            <small>It needs changes. The person fixes it and hands it in again.</small>
          </button>
        </div>
      </div>
      {beyondIncluded && (
        <div className="alert warn">
          The next round goes past the {included} included. Agree any extra rounds with the client before sending it back.
        </div>
      )}
      <div className="field">
        <label htmlFor="review_feedback">{result === 'fail' ? 'What needs to change? *' : 'A comment (optional)'}</label>
        <textarea
          id="review_feedback"
          rows={3}
          required={result === 'fail'}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={result === 'fail' ? 'Be specific: what to change and why' : 'Optional'}
        />
      </div>
      <details className="tf-fold">
        <summary>Rate the work <small>(optional)</small></summary>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="review_rating" className="sr-only">Rating</label>
          <select id="review_rating" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} out of 5</option>)}
          </select>
        </div>
      </details>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{result === 'pass' ? 'Approve it' : 'Send it back'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}
