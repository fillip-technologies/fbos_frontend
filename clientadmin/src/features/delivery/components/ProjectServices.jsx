import { useState } from 'react'
import { Link } from 'react-router-dom'
import { recurringApi, routingApi, setupApi, tasksApi } from '@/features/delivery/api.js'
import { PLAYBOOK_LABEL } from '@/features/delivery/playbooks.js'
import { SUBJECT_TYPES, formatDay } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st.
function ordinal(n) {
  const endings = ['th', 'st', 'nd', 'rd']
  const rest = n % 100
  return `${n}${endings[(rest - 20) % 10] || endings[rest] || endings[0]}`
}

// "FREQ=MONTHLY;BYMONTHDAY=5" read back as words; anything else is shown as it is.
function describe(rule) {
  const monthly = /FREQ=MONTHLY/.test(rule) && rule.match(/BYMONTHDAY=(\d+)/)
  return monthly ? `Every month on the ${ordinal(Number(monthly[1]))}` : rule
}

// The list answers a time without its zone ("2026-11-30T18:30:00", meaning UTC), which the browser
// would read as local time and show a day early. A time with a zone is shown as it is.
function day(iso) {
  if (!iso) return '—'
  return formatDay(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
}

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// What this client is given, in one place: the services that follow a checklist, once or every
// month. One button adds one. A one-time service is a task with every item to tick, made now; a
// monthly one is made by delivery's worker (live server) on the chosen day, by itself.
export default function ProjectServices({ orgId, project, names }) {
  const { user: me } = useAuth()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)
  const canAdd = hasAccess(me, ACCESS.manageTasks)
  const { data, error, loading, reload } = useQuery(
    ['recurring-rules', orgId, project.id],
    ({ signal }) => recurringApi.list(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const { data: templates } = useQuery(['task-templates', orgId], ({ signal }) => setupApi.taskTemplates(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const rules = (data?.data ?? []).filter((r) => r.status !== 'ended')
  const titleOf = (code) => (templates ?? []).find((t) => t.code === code)?.title_template ?? code

  // The tasks the monthly rules made for this project (all of them, finished too), to show how the
  // latest one is going. A task made by a rule is titled "<checklist> · <day>".
  const { data: made } = useQuery(
    ['tasks', orgId, { project: project.id, services: true }],
    ({ signal }) => tasksApi.list(orgId, { limit: 100, subject_type: SUBJECT_TYPES.project, subject_id: project.id }, { signal }),
    { enabled: Boolean(orgId) && rules.length > 0 }
  )
  const latestFor = (rule) =>
    (made?.data ?? [])
      .filter((t) => t.source === 'recurring' && t.title.startsWith(`${titleOf(rule.template_code)} · `))
      .sort((a, b) => b.code.localeCompare(a.code))[0] ?? null

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="section-head">
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>Services for this client</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Work that follows a checklist, such as social media. Add it once, or have it made again every month.
          </p>
        </div>
        <div className="row-actions">
          {hasAccess(me, ACCESS.deliverySetup) && <Link className="small" to="/playbooks">Edit checklists</Link>}
          {canAdd && !adding && <button className="btn" onClick={() => { setNotice(null); setAdding(true) }}>+ Add a service</button>}
        </div>
      </div>

      {notice && (
        <div className="alert success">
          {notice.text} {notice.taskId && <Link to={`/tasks/${notice.taskId}`}>Open it</Link>}
        </div>
      )}
      <ErrorBanner error={error} onRetry={reload} />

      {adding && (
        <AddService
          orgId={orgId}
          project={project}
          names={names}
          templates={templates ?? []}
          onClose={() => setAdding(false)}
          onDone={(result) => {
            setAdding(false)
            setNotice(result)
          }}
        />
      )}

      {loading ? null : rules.length === 0 ? (
        !adding && (
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Nothing repeats every month for this client yet. Checklists you add once show in the task list below.
          </p>
        )
      ) : (
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
          {rules.map((r) => (
            <li key={r.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{titleOf(r.template_code)}</strong>
              <div className="muted small">
                {describe(r.rrule)} · {names.unitName(r.owning_unit)}
                {r.next_run_at ? ` · next: ${day(r.next_run_at)}` : ''}
                {r.ends_at ? ` · until ${day(r.ends_at)}` : ''}
                {r.status === 'paused' ? ' · paused' : ''}
              </div>
              <LatestProgress task={latestFor(r)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// How the latest task a monthly service made is going: its ticked items out of all, as a bar.
function LatestProgress({ task }) {
  if (!task) return <div className="muted small" style={{ marginTop: 4 }}>Nothing made yet. The first one appears on its day.</div>
  const total = task.checklist?.length ?? 0
  const done = (task.checklist ?? []).filter((i) => i.done).length
  const finished = task.status === 'done'
  const pct = finished ? 100 : total ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ marginTop: 6 }}>
      <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
        <span className="muted">{finished ? '✓ Done' : total ? `${done}/${total} steps done` : 'Not started'}</span>
      </div>
      <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: finished ? '#1baf7a' : 'var(--brand)' }} />
      </div>
    </div>
  )
}

function AddService({ orgId, project, names, templates, onClose, onDone }) {
  const [how, setHow] = useState('monthly') // 'once' | 'monthly'
  const [templateCode, setTemplateCode] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [unitId, setUnitId] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const template = templates.find((t) => t.code === templateCode)
  // The team the company's routing rules give this kind of work, else the project's own team.
  const { data: routed } = useLookup(
    ['task-routing', orgId, template?.task_type?.code ?? 'none', 'none'],
    ({ signal }) => routingApi.route(orgId, template.task_type.code, null, { signal }),
    { enabled: Boolean(template) }
  )
  const team = unitId || routed?.unit?.id || project.owning_unit?.id || ''
  const units = (names.units ?? []).filter((u) => u.status !== 'inactive')
  const clientName = (project.client && names.customerName(project.client)) || ''
  const client = clientName && clientName !== '—' ? clientName : project.name

  async function save(e) {
    e.preventDefault()
    if (!template || !team) return
    setError(null)
    setBusy(true)
    try {
      if (how === 'once') {
        const task = await tasksApi.create(orgId, {
          title: `${template.title_template} · ${client}`,
          task_type_code: template.task_type.code,
          priority: template.default_priority,
          checklist: template.checklist.map((i) => ({ text: i.text, mandatory: i.mandatory !== false })),
          labels: [PLAYBOOK_LABEL],
          owning_unit_id: team,
          subject: { type: SUBJECT_TYPES.project, id: project.id },
          ...(template.description ? { description: template.description } : {}),
        })
        invalidate(['tasks', orgId])
        invalidate(['project', orgId, project.id])
        onDone({ text: `“${template.title_template}” started for ${client}.`, taskId: task.id })
      } else {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const rule = await recurringApi.create(orgId, {
          template_code: template.code,
          subject: { type: SUBJECT_TYPES.project, id: project.id },
          owning_unit_id: team,
          rrule: `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`,
          timezone: browserZone(),
          starts_at: start.toISOString(),
          ...(endsOn ? { ends_at: new Date(`${endsOn}T23:59:59`).toISOString() } : {}),
        })
        invalidate(['recurring-rules', orgId, project.id])
        onDone({ text: `“${template.title_template}” will be made every month. The first one is on ${day(rule.next_run_at)}.` })
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} style={{ margin: '12px 0' }}>
      <ErrorBanner error={error} />
      <div className="field">
        <label>How often?</label>
        <div className="rv-choice" role="radiogroup" aria-label="How often">
          <button type="button" role="radio" aria-checked={how === 'monthly'} className={`rv-opt pass${how === 'monthly' ? ' chosen' : ''}`} onClick={() => setHow('monthly')}>
            <strong>Every month</strong>
            <small>A new checklist task is made by itself on the day you choose.</small>
          </button>
          <button type="button" role="radio" aria-checked={how === 'once'} className={`rv-opt pass${how === 'once' ? ' chosen' : ''}`} onClick={() => setHow('once')}>
            <strong>Once, now</strong>
            <small>One checklist task is made right away for the team.</small>
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="sv_template">Which service? *</label>
          <select id="sv_template" required value={templateCode} onChange={(e) => setTemplateCode(e.target.value)}>
            <option value="">Choose…</option>
            {templates.map((t) => <option key={t.code} value={t.code}>{t.title_template}</option>)}
          </select>
          {templates.length === 0 && <div className="hint">No checklists yet. Make one under Service checklists first.</div>}
        </div>
        <div className="field">
          <label htmlFor="sv_team">Which team does it? *</label>
          {units.length > 0 ? (
            <select id="sv_team" required value={team} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Choose the team…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : (
            <input id="sv_team" readOnly value={team ? names.unitName({ id: team }) : '—'} />
          )}
        </div>
        {how === 'monthly' && (
          <div className="field">
            <label htmlFor="sv_day">Make it on day *</label>
            <select id="sv_day" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{ordinal(d)} of every month</option>)}
            </select>
          </div>
        )}
      </div>

      {how === 'monthly' && (
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="sv_end">Stop after <span className="muted">(optional)</span></label>
          <input id="sv_end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          <div className="hint">Set this if the contract ends. A monthly service can’t be stopped from here yet.</div>
        </div>
      )}

      <p className="muted small">
        {how === 'monthly'
          ? `The first one is made on the next ${ordinal(dayOfMonth)}, and starts in the team’s queue. For this month, add it “Once, now”.`
          : 'The team gets one task with every item to tick, in its queue.'}
      </p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy || !template || !team} aria-busy={busy}>
          {how === 'monthly' ? 'Repeat every month' : 'Start it now'}
        </button>
        <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
