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

export default function Handovers({ orgId, names }) {
  const { user: me } = useAuth()
  const canAnswer = hasAccess(me, ACCESS.manageHandovers)
  const [filters, setFilters] = useState({ status: 'requested', to_unit_id: '' })
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
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
  const [answering, setAnswering] = useState(null) // { handover, accept: boolean }
  const [busy, setBusy] = useState(false)
  const [answerError, setAnswerError] = useState(null)

  const setFilter = (key, value) => {
    setCursor(undefined)
    setStack([])
    setFilters((f) => ({ ...f, [key]: value }))
  }

  async function answer(text) {
    const { handover, accept } = answering
    setAnswerError(null)
    setBusy(true)
    try {
      if (accept) await handoversApi.accept(orgId, handover.id, text ? { note: text } : {})
      else await handoversApi.reject(orgId, handover.id, { reason: text })
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

  return (
    <>
      <div className="toolbar">
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All handovers</option>
          {Object.entries(HANDOVER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{value === 'requested' ? 'Waiting for an answer' : label}</option>
          ))}
        </select>
        {names.units && (
          <select value={filters.to_unit_id} onChange={(e) => setFilter('to_unit_id', e.target.value)}>
            <option value="">To any team</option>
            {names.units.map((u) => (
              <option key={u.id} value={u.id}>To {u.name}</option>
            ))}
          </select>
        )}
      </div>

      <ErrorBanner error={answerError || error} onRetry={answerError ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Work</th>
              <th>From → to</th>
              <th>Why</th>
              <th>Asked</th>
              <th>Status</th>
              {canAnswer && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canAnswer ? 6 : 5} rows={4} />
            ) : handovers.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No handovers.</td></tr>
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
                      {h.notes && <div className="muted">{h.notes}</div>}
                      {h.rejection_reason && <div className="muted">Rejected: {h.rejection_reason}</div>}
                    </td>
                    <td className="small">
                      {names.personName(h.requested_by)}
                      <div className="muted">{formatDateTime(h.created_at)}</div>
                    </td>
                    <td><StatusBadge status={h.status} label={HANDOVER_STATUS_LABELS[h.status]} /></td>
                    {canAnswer && (
                      <td className="row-actions">
                        {h.status === 'requested' && (
                          <>
                            <button className="btn secondary small-btn" onClick={() => setAnswering({ handover: h, accept: true })}>Accept</button>
                            <button className="btn secondary small-btn" onClick={() => setAnswering({ handover: h, accept: false })}>Reject</button>
                          </>
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

      {answering && <AnswerForm answering={answering} names={names} busy={busy} onCancel={() => setAnswering(null)} onSubmit={answer} />}
    </>
  )
}

function AnswerForm({ answering, names, busy, onCancel, onSubmit }) {
  const [text, setText] = useState('')
  const { handover, accept } = answering
  return (
    <form
      className="panel"
      style={{ marginTop: 16 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(text.trim())
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        {accept ? 'Accept' : 'Reject'} the handover to {names.unitName(handover.to_unit)}
      </h2>
      {accept && (
        <p className="muted small" style={{ marginTop: 0 }}>
          The work moves to {names.unitName(handover.to_unit)}. Whoever was working on it is taken off it (it stays in the task's
          history) and {names.unitName(handover.to_unit)} assigns one of its own people. Work waiting for review stays with its reviewer.
        </p>
      )}
      <div className="field">
        <label htmlFor="handover_answer">{accept ? 'Note' : 'Why not *'}</label>
        <input id="handover_answer" required={!accept} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{accept ? 'Accept' : 'Reject'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
