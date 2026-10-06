import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import { formatDateTime } from '@/features/delivery/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The task's conversation, oldest first. Anyone who can see the task can comment.
export default function TaskComments({ orgId, task, names }) {
  const { data: comments = [], error, reload, setData } = useQuery(
    ['task', orgId, task.id, 'comments'],
    ({ signal }) => tasksApi.comments(orgId, task.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState(null)

  async function post(e) {
    e.preventDefault()
    setPostError(null)
    setBusy(true)
    try {
      const comment = await tasksApi.addComment(orgId, task.id, { body: body.trim() })
      setData((list) => [...(list ?? []), comment])
      setBody('')
    } catch (err) {
      setPostError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Comments</h2>
      <ErrorBanner error={postError || error} onRetry={postError ? undefined : reload} />
      {comments.length === 0 && <p className="muted small">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="small">
            <strong>{names.personName(c.author)}</strong> <span className="muted">{formatDateTime(c.created_at)}</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
        </div>
      ))}
      <form onSubmit={post} style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="comment_body">Add a comment</label>
          <textarea id="comment_body" rows={2} required value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button className="btn secondary" type="submit" disabled={busy || !body.trim()} aria-busy={busy}>Comment</button>
      </form>
    </div>
  )
}
