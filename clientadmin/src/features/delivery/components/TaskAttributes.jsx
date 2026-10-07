import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import TaskFieldInputs from '@/features/delivery/components/TaskFieldInputs.jsx'
import { attributeErrors, checkFields, formatFieldValue, isEmpty, toAttributes, toFormValues } from '@/features/delivery/taskFields.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The task's own fields (from its type and the company's custom fields), how it turned out,
// and where it sits in a cadence. Its assignee or a task manager fills them in.
export default function TaskAttributes({ orgId, task, setTask, taskType, fields }) {
  const { user: me } = useAuth()
  const canEdit = (task.assignee?.id === me?.id || hasAccess(me, ACCESS.manageTasks)) && !['done', 'cancelled'].includes(task.status)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [problems, setProblems] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const outcome = taskType?.outcomes?.find((o) => o.code === task.outcome)
  const hasCadence = task.cadence_step > 1 || task.follow_up_task_id || task.attributes?.follow_up_of

  if (!fields.length && !outcome && !hasCadence) return null

  function startEditing() {
    setValues(toFormValues(fields, task.attributes))
    setProblems({})
    setError(null)
    setEditing(true)
  }

  async function save(e) {
    e.preventDefault()
    const found = checkFields(fields, values)
    setProblems(found)
    if (Object.keys(found).length) return
    // Cleared fields are sent empty, which removes them.
    const cleared = Object.fromEntries(fields.filter((f) => !isEmpty(task.attributes?.[f.key]) && isEmpty(values[f.key])).map((f) => [f.key, null]))
    setBusy(true)
    setError(null)
    try {
      setTask(await tasksApi.update(orgId, task.id, task.version, { attributes: { ...cleared, ...toAttributes(fields, values) } }))
      setEditing(false)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const serverProblems = attributeErrors(error)
  return (
    <div className="panel">
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{taskType ? `${taskType.name} details` : 'Details'}</h2>
        {canEdit && !editing && fields.length > 0 && <button className="btn secondary small-btn" onClick={startEditing}>Edit</button>}
      </div>

      {(outcome || hasCadence) && (
        <div className="row-actions" style={{ flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 4px' }}>
          {outcome && <span className={`outcome ${outcome.kind} chosen static`}>{outcome.label}</span>}
          {task.cadence_step > 1 && <span className="chip subtle">Touch {task.cadence_step}</span>}
          {task.attributes?.follow_up_of && <Link className="small" to={`/tasks/${task.attributes.follow_up_of}`}>← Previous touch</Link>}
          {task.follow_up_task_id && <Link className="small" to={`/tasks/${task.follow_up_task_id}`}>Next touch →</Link>}
        </div>
      )}

      {editing ? (
        <form onSubmit={save} style={{ marginTop: 12 }}>
          {error && Object.keys(serverProblems).length === 0 && <ErrorBanner error={error} />}
          <TaskFieldInputs fields={fields} values={values} onChange={setValues} errors={{ ...serverProblems, ...problems }} idPrefix="edit" />
          <div className="row-actions">
            <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Save</button>
            <button className="btn secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        fields.length > 0 && (
          <div className="details-grid" style={{ marginTop: 12 }}>
            {fields.map((field) => (
              <div key={field.key} className={field.type === 'long_text' ? 'span-all' : undefined}>
                <div className="detail-label">
                  {field.label}
                  {field.required_on_submit && isEmpty(task.attributes?.[field.key]) && <span className="needed"> · needed to submit</span>}
                </div>
                <div className="detail-value" style={field.type === 'long_text' ? { whiteSpace: 'pre-wrap' } : undefined}>
                  <Value field={field} value={task.attributes?.[field.key]} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function Value({ field, value }) {
  if (isEmpty(value)) return <span className="muted">—</span>
  if (field.type === 'url') return <a href={value} target="_blank" rel="noreferrer">{value}</a>
  if (field.type === 'email') return <a href={`mailto:${value}`}>{value}</a>
  if (field.type === 'phone') return <a href={`tel:${String(value).replace(/[^+0-9]/g, '')}`}>{value}</a>
  return formatFieldValue(field, value)
}
