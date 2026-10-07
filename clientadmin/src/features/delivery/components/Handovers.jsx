import { useState } from 'react'
import { Link } from 'react-router-dom'
import { handoversApi, projectsApi, tasksApi } from '@/features/delivery/api.js'
import { HANDOVER_STATUS_LABELS, SUBJECT_TYPES, formatDateTime } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// Incoming: waiting for the team's answer. Outgoing: the team asked, nobody answered yet.
// History: everything answered or withdrawn.
const VIEWS = [
  ['incoming', 'Incoming'],
  ['outgoing', 'Outgoing'],
  ['history', 'History'],
]
const ANSWERED = ['accepted', 'rejected', 'returned', 'cancelled']

// What a handover is about, fetched with the page: the list itself names only ids.
async function subjectsOf(orgId, handovers, signal) {
  const unique = [...new Map(handovers.map((h) => [h.subject.id, h.subject])).values()]
  const loaded = await Promise.all(
    unique.map((s) => {
      const load = s.type === SUBJECT_TYPES.task ? tasksApi.get : projectsApi.get
      return load(orgId, s.id, { signal }).then((record) => [s.id, record]).catch(() => [s.id, null])
    })
  )
  return Object.fromEntries(loaded)
}

const subjectPath = (subject) => (subject.type === SUBJECT_TYPES.task ? `/tasks/${subject.id}` : `/projects/${subject.id}`)

function filtersFor(view, unitId) {
  if (view === 'incoming') return { status: 'requested', ...(unitId ? { to_unit_id: unitId } : {}) }
  if (view === 'outgoing') return { status: 'requested', ...(unitId ? { from_unit_id: unitId } : {}) }
  return { status: ANSWERED, ...(unitId ? { to_unit_id: unitId } : {}) }
}

export default function Handovers({ orgId, names }) {
  const { user: me } = useAuth()
  const canAnswer = hasAccess(me, ACCESS.manageHandovers)
  const [view, setView] = useState('incoming')
  const [unitId, setUnitId] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const filters = filtersFor(view, unitId)
  const { data, error, loading, refreshing, reload } = useQuery(
    ['handovers', orgId, { cursor, filters }],
    async ({ signal }) => {
      const page = await handoversApi.list(orgId, { limit: 25, cursor, ...filters }, { signal })
      return { ...page, subjects: await subjectsOf(orgId, page.data, signal) }
    },
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const handovers = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null
  const [answering, setAnswering] = useState(null) // { handover, action: 'accept' | 'reject' | 'cancel' }
  const [busy, setBusy] = useState(false)
  const [answerError, setAnswerError] = useState(null)

  const resetPaging = () => {
    setCursor(undefined)
    setStack([])
  }

  async function answer(body) {
    const { handover, action } = answering
    setAnswerError(null)
    setBusy(true)
    try {
      if (action === 'accept') await handoversApi.accept(orgId, handover.id, body)
      if (action === 'reject') await handoversApi.reject(orgId, handover.id, body)
      if (action === 'cancel') await handoversApi.cancel(orgId, handover.id, body)
      // Accepting moves the work to the receiving team.
      const recordKey = handover.subject.type === SUBJECT_TYPES.task ? 'task' : 'project'
      invalidate([recordKey, orgId, handover.subject.id])
      invalidate([recordKey === 'task' ? 'tasks' : 'projects', orgId])
      invalidate(['handovers', orgId])
      setAnswering(null)
    } catch (err) {
      setAnswerError(err)
    } finally {
      setBusy(false)
    }
  }

  const showActions = canAnswer && view !== 'history'
  const cols = showActions ? 6 : 5
  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => { resetPaging(); setView(key) }}>
              {label}
            </button>
          ))}
        </div>
        {names.units && (
          <select aria-label="Team" value={unitId} onChange={(e) => { resetPaging(); setUnitId(e.target.value) }}>
            <option value="">{view === 'outgoing' ? 'From any team' : 'To any team'}</option>
            {names.units.map((u) => (
              <option key={u.id} value={u.id}>{view === 'outgoing' ? 'From' : 'To'} {u.name}</option>
            ))}
          </select>
        )}
      </div>

      <ErrorBanner error={answering ? null : error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Work</th>
              <th>From → to</th>
              <th>Why</th>
              <th>Asked</th>
              <th>Status</th>
              {showActions && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={cols} rows={4} />
            ) : handovers.length === 0 ? (
              <tr><td colSpan={cols} className="center-note">{EMPTY[view]}</td></tr>
            ) : (
              handovers.map((h) => {
                const record = data.subjects[h.subject.id]
                return (
                  <tr key={h.id} style={{ cursor: 'default' }}>
                    <td>
                      <Link to={subjectPath(h.subject)}>{record ? record.title || record.name : 'Open'}</Link>
                      <div className="muted small">
                        {h.subject.type === SUBJECT_TYPES.task ? 'Task' : 'Project'}
                        {record && <> · <span className="mono">{record.code}</span></>}
                      </div>
                    </td>
                    <td>{names.unitName(h.from_unit)} → <strong>{names.unitName(h.to_unit)}</strong></td>
                    <td className="small">
                      {h.reason}
                      {h.notes && <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{h.notes}</div>}
                      {h.rejection_reason && <div className="muted">Rejected: {h.rejection_reason}</div>}
                    </td>
                    <td className="small">
                      {names.personName(h.requested_by)}
                      <div className="muted">{formatDateTime(h.created_at)}</div>
                      {h.responded_at && <div className="muted">Answered {formatDateTime(h.responded_at)}{h.responded_by && ` by ${names.personName(h.responded_by)}`}</div>}
                    </td>
                    <td><StatusBadge status={h.status} label={HANDOVER_STATUS_LABELS[h.status]} /></td>
                    {showActions && (
                      <td className="row-actions">
                        {h.status === 'requested' && view === 'incoming' && (
                          <>
                            <button className="btn secondary small-btn" onClick={() => setAnswering({ handover: h, action: 'accept' })}>Accept</button>
                            <button className="btn secondary small-btn" onClick={() => setAnswering({ handover: h, action: 'reject' })}>Reject</button>
                          </>
                        )}
                        {h.status === 'requested' && view === 'outgoing' && (
                          <button className="btn secondary small-btn" onClick={() => setAnswering({ handover: h, action: 'cancel' })}>Withdraw</button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>

      {answering && (
        <AnswerForm
          answering={answering}
          record={data?.subjects?.[answering.handover.subject.id]}
          names={names}
          busy={busy}
          error={answerError}
          onCancel={() => { setAnswering(null); setAnswerError(null) }}
          onSubmit={answer}
        />
      )}
    </>
  )
}

const EMPTY = {
  incoming: 'Nothing waiting for an answer.',
  outgoing: 'No handovers waiting on another team.',
  history: 'No answered handovers yet.',
}

function AnswerForm({ answering, record, names, busy, error, onCancel, onSubmit }) {
  const { user: me } = useAuth()
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('')
  const { handover, action } = answering
  const isTask = handover.subject.type === SUBJECT_TYPES.task
  const to = names.unitName(handover.to_unit)
  const title = { accept: `Accept the handover to ${to}`, reject: `Reject the handover to ${to}`, cancel: 'Withdraw the handover' }[action]

  function handleSubmit(e) {
    e.preventDefault()
    const value = text.trim()
    if (action === 'accept') onSubmit({ ...(value ? { note: value } : {}), ...(assignee ? { assignee_user_id: assignee } : {}) })
    else onSubmit({ reason: value })
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>{title}{record ? `: ${record.title || record.name}` : ''}</h2>
      <ErrorBanner error={error} />
      {action === 'accept' && (
        <p className="muted small" style={{ marginTop: 0 }}>
          The work moves to {to}.{' '}
          {isTask
            ? 'Name who takes it on now, or leave it in the team’s queue for someone to take. Work already in progress keeps its status.'
            : 'The project’s owning team changes; its manager and members stay.'}
        </p>
      )}
      <div className="grid-2">
        {action === 'accept' && isTask && names.people && (
          <div className="field">
            <label htmlFor="handover_assignee">Who takes it on</label>
            <select id="handover_assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Leave it in {to}’s queue —</option>
              {names.people.map((u) => <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="handover_answer">{action === 'accept' ? 'Note' : action === 'reject' ? 'What’s missing before you can take it? *' : 'Why withdraw it? *'}</label>
          <input id="handover_answer" required={action !== 'accept'} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{{ accept: 'Accept', reject: 'Reject', cancel: 'Withdraw' }[action]}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
