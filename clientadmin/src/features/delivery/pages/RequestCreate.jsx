import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestsApi } from '@/features/delivery/api.js'
import TaskFieldInputs from '@/features/delivery/components/TaskFieldInputs.jsx'
import { DISCIPLINE_ORDER, attributeErrors, checkFields, disciplineLabel, toAttributes } from '@/features/delivery/taskFields.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes, { useTaskFields } from '@/features/delivery/useTaskTypes.js'
import { TASK_PRIORITY_LABELS, dueAtFromDate } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const ANY_VERTICAL = ''

// Ask another team for work. Delivery's routing rules decide which team gets each kind of work
// (and, for some, which business line it is for); only the kinds a team takes requests for are
// offered. The request waits in that team's queue until someone there takes it.
export default function RequestCreate() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const { byCode } = useTaskTypes(orgId)
  const { data: requestable, error: loadError, loading, reload } = useLookup(
    ['requestable-types', orgId],
    ({ signal }) => requestsApi.types(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )

  const [form, setForm] = useState({ task_type_code: '', vertical: ANY_VERTICAL, title: '', description: '', priority: 'p3', due_date: '' })
  const [values, setValues] = useState({})
  const [problems, setProblems] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  // One entry per kind of work and business line it is taken for (none: any other one).
  const offers = requestable?.data ?? []
  const kinds = [...new Map(offers.map((o) => [o.task_type_code, o])).values()]
  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...kinds.map((k) => k.discipline)])].filter((d) => kinds.some((k) => k.discipline === d))
  const forKind = offers.filter((o) => o.task_type_code === form.task_type_code)
  const askVertical = forKind.some((o) => o.vertical)
  const offer = forKind.find((o) => (o.vertical?.id ?? ANY_VERTICAL) === form.vertical) ?? (askVertical ? null : forKind[0] ?? null)

  const taskType = byCode.get(form.task_type_code)
  // The fields a task of that team carries: its type's, and the company's custom fields for the team.
  const fields = useTaskFields(orgId, taskType, offer?.unit?.id ?? null, null)
  const createFields = fields.filter((f) => !f.required_on_submit)
  const serverProblems = attributeErrors(error)
  const fieldErrors = { ...getFieldErrors(error), ...serverProblems, ...problems }

  function chooseKind(code) {
    const verticals = offers.filter((o) => o.task_type_code === code)
    // The business line is asked for only when the kind is taken for particular ones.
    const only = verticals.length === 1 ? verticals[0].vertical?.id ?? ANY_VERTICAL : ANY_VERTICAL
    setForm((f) => ({ ...f, task_type_code: code, vertical: only }))
    setValues({})
    setProblems({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!offer) return
    const found = checkFields(createFields, values)
    setProblems(found)
    if (Object.keys(found).length) return
    setError(null)
    setSubmitting(true)
    try {
      const body = { task_type_code: form.task_type_code, title: form.title.trim(), priority: form.priority }
      if (offer.vertical) body.vertical_id = offer.vertical.id
      if (form.description.trim()) body.description = form.description.trim()
      if (form.due_date) body.due_at = dueAtFromDate(form.due_date)
      const attributes = toAttributes(createFields, values)
      if (Object.keys(attributes).length) body.attributes = attributes
      const created = await requestsApi.create(orgId, body)
      invalidate(['requests', orgId])
      invalidate(['tasks', orgId])
      navigate(hasAccess(me, ACCESS.tasks) ? `/tasks/${created.id}` : '/requests', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PanelSkeleton />
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New request</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>Ask a team in “{activeOrg.name}” for work</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      <ErrorBanner error={loadError} onRetry={reload} />
      {error && Object.keys(getFieldErrors(error)).length === 0 && Object.keys(serverProblems).length === 0 && <ErrorBanner error={error} />}

      {requestable && kinds.length === 0 ? (
        <div className="alert info">
          No team takes requests yet. An admin opens a kind of work to requests with a routing rule on the Task types page.
        </div>
      ) : (
        <form className="panel" onSubmit={handleSubmit}>
          <fieldset className="type-picker">
            <legend>What do you need? *</legend>
            {disciplines.map((discipline) => (
              <div key={discipline} className="type-group">
                <div className="type-group-label"><span className={`discipline-dot ${discipline}`} /> {disciplineLabel(discipline)}</div>
                <div className="type-options">
                  {kinds.filter((k) => k.discipline === discipline).map((k) => (
                    <label key={k.task_type_code} className={`type-option${form.task_type_code === k.task_type_code ? ' chosen' : ''}`}>
                      <input
                        type="radio"
                        name="task_type"
                        value={k.task_type_code}
                        checked={form.task_type_code === k.task_type_code}
                        onChange={() => chooseKind(k.task_type_code)}
                      />
                      {k.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          {askVertical && (
            <div className="field">
              <label htmlFor="vertical">For which business line? *</label>
              <select id="vertical" required value={form.vertical} onChange={(e) => set('vertical', e.target.value)}>
                {forKind.length > 1 && !forKind.some((o) => !o.vertical) && <option value="">— Choose —</option>}
                {forKind.map((o) => (
                  <option key={o.vertical?.id ?? 'any'} value={o.vertical?.id ?? ANY_VERTICAL}>
                    {o.vertical ? names.verticalName(o.vertical) : 'Any other business line'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {offer && (
            <p className="muted small" style={{ marginTop: 0 }}>
              Goes to <strong>{names.unitName(offer.unit)}</strong>, where someone in the team takes it from their queue.
            </p>
          )}

          <div className="field">
            <label htmlFor="title">What should be done? *</label>
            <input id="title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
            {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
          </div>
          <div className="field">
            <label htmlFor="description">Details</label>
            <textarea id="description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {createFields.length > 0 && (
            <div className="subpanel">
              <div className="subpanel-title">{taskType?.name} details</div>
              <TaskFieldInputs fields={createFields} values={values} onChange={setValues} errors={fieldErrors} />
            </div>
          )}

          <div className="grid-2">
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="due_date">Needed by</label>
              <input id="due_date" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>

          <button className="btn" type="submit" disabled={submitting || !offer} aria-busy={submitting}>Send request</button>
        </form>
      )}
    </div>
  )
}
