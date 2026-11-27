import '@/features/delivery/playbooks.css'
import '@/features/delivery/task-types.css'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { projectsApi, routingApi, setupApi, tasksApi } from '@/features/delivery/api.js'
import { PLAYBOOK_LABEL, STARTER_CHECKLISTS } from '@/features/delivery/playbooks.js'
import { disciplineLabel } from '@/features/delivery/taskFields.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const slug = (text) => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
let rowSeq = 0
const rowId = () => `item-${(rowSeq += 1)}`
const PRIORITIES = ['p1', 'p2', 'p3', 'p4']

// Service checklists: one per service a company sells (SMM, Local SEO, Ads…). Admins keep them;
// "Start for a client" gives the team a task with every item on it, to tick one by one.
// A checklist is a task template, so the same ones also serve workflows and recurring tasks.
export default function Playbooks() {
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const { active: types, byCode } = useTaskTypes(orgId)
  const [editing, setEditing] = useState(null) // { template?, draft }
  const [starting, setStarting] = useState(null) // template
  const [notice, setNotice] = useState(null)
  const [params] = useSearchParams()

  const { data, error, loading, reload } = useQuery(['task-templates', orgId], ({ signal }) => setupApi.taskTemplates(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const templates = data ?? []
  // A checklist task is made without anyone filling boxes in, and shows its kind of work's boxes
  // (a bug fix asks for severity and a pull request), so only kinds of work with no boxes at all
  // can carry one: the general “Task”, or one made for this, such as “Service checklist”.
  const usableTypes = types.filter((t) => t.fields.length === 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Service checklists</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            One checklist for each service you give clients, such as SMM, Local SEO or Ads, in {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
            Start it for a client and the team gets a task with every item to tick.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          <button className="btn" onClick={() => { setStarting(null); setEditing({ draft: blankDraft(usableTypes) }) }}>+ New checklist</button>
        </div>
      </div>

      {notice && (
        <div className="alert success">
          {notice.text} <Link to={`/tasks/${notice.id}`}>Open it</Link>
        </div>
      )}
      <ErrorBanner error={error} onRetry={reload} />

      {editing && (
        <PlaybookEditor
          key={editing.template?.id || 'new'}
          orgId={orgId}
          existing={editing.template}
          initial={editing.draft}
          types={usableTypes}
          onClose={() => setEditing(null)}
          onSaved={(name) => { setEditing(null); setNotice({ text: `“${name}” saved.` }) }}
        />
      )}

      {starting && (
        <StartForm
          key={starting.id}
          orgId={orgId}
          template={starting}
          names={names}
          typeName={byCode.get(starting.task_type.code)?.name ?? starting.task_type.name}
          initialProject={params.get('project')}
          onClose={() => setStarting(null)}
          onStarted={(task, client) => { setStarting(null); setNotice({ text: `Started “${starting.title_template}” for ${client}.`, id: task.id }) }}
        />
      )}

      {!editing && !starting && (
        <div className="tt-quick">
          <strong>Start from a ready checklist</strong>
          <div className="chips">
            {STARTER_CHECKLISTS.map((c) => (
              <button
                key={c.name}
                type="button"
                className="chip"
                onClick={() => { setNotice(null); setEditing({ draft: { ...blankDraft(usableTypes), name: c.name, items: c.items.map((text) => ({ id: rowId(), text, mandatory: true })) } }) }}
              >
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <PanelSkeleton />
      ) : templates.length === 0 ? (
        <div className="panel empty-state">
          <h2>No checklists yet</h2>
          <p className="muted">Make one for a service, for example “SMM”: list everything that must be done for a client, then start it for each new client.</p>
        </div>
      ) : (
        <div className="pb-list">
          {templates.map((t) => (
            <article key={t.id} className="pb-card">
              <div className="pb-card-head">
                <div>
                  <strong>{t.title_template}</strong>
                  <div className="muted small">
                    {byCode.get(t.task_type.code)?.name ?? t.task_type.name} · {disciplineLabel(t.task_type.discipline)} · {TASK_PRIORITY_LABELS[t.default_priority] ?? t.default_priority}
                  </div>
                </div>
                <span className="pb-count">{t.checklist.length} items</span>
              </div>
              <ol className="pb-items">
                {t.checklist.slice(0, 5).map((item, i) => <li key={i}>{item.text}{item.mandatory === false && <small> · optional</small>}</li>)}
              </ol>
              {t.checklist.length > 5 && <p className="muted small" style={{ margin: '0 0 8px' }}>and {t.checklist.length - 5} more</p>}
              <div className="row-actions">
                <button className="btn" onClick={() => { setEditing(null); setNotice(null); setStarting(t) }}>Start for a client</button>
                <button className="btn secondary" onClick={() => { setStarting(null); setEditing({ template: t, draft: toDraft(t) }) }}>Edit</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function blankDraft(types) {
  return { name: '', task_type_code: (types.find((t) => t.code === 'task') ?? types[0])?.code ?? '', priority: 'p3', description: '', items: [{ id: rowId(), text: '', mandatory: true }] }
}

function toDraft(t) {
  return {
    name: t.title_template, task_type_code: t.task_type.code, priority: t.default_priority, description: t.description ?? '',
    items: t.checklist.map((i) => ({ id: rowId(), text: i.text, mandatory: i.mandatory !== false })),
  }
}

function PlaybookEditor({ orgId, existing, initial, types, onClose, onSaved }) {
  const isNew = !existing
  const [draft, setDraft] = useState(initial)
  const [paste, setPaste] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const updateItem = (id, changes) => set('items', draft.items.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  const removeItem = (id) => set('items', draft.items.filter((i) => i.id !== id))
  const moveItem = (id, delta) => {
    const items = [...draft.items]
    const index = items.findIndex((i) => i.id === id)
    const target = index + delta
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    set('items', items)
  }
  const addPasted = () => {
    const lines = paste.split('\n').map((l) => l.replace(/^\s*(?:[-*•☐]|\d+[.)])\s*/, '').trim()).filter(Boolean)
    if (!lines.length) return
    const kept = draft.items.filter((i) => i.text.trim())
    set('items', [...kept, ...lines.map((text) => ({ id: rowId(), text, mandatory: true }))])
    setPaste('')
  }
  const typeStillOffered = types.some((t) => t.code === draft.task_type_code)

  async function save(e) {
    e.preventDefault()
    const checklist = draft.items.map((i) => ({ text: i.text.trim(), mandatory: i.mandatory })).filter((i) => i.text)
    if (!draft.name.trim()) return setProblem('Give the checklist a name, for example “SMM”.')
    if (!draft.task_type_code) return setProblem('Choose the kind of work.')
    if (!checklist.length) return setProblem('Add at least one item.')
    if (checklist.some((i) => i.text.length > 500)) return setProblem('An item can have at most 500 characters.')
    setProblem('')
    setError(null)
    setBusy(true)
    try {
      const body = {
        task_type_code: draft.task_type_code, title_template: draft.name.trim(), checklist,
        default_priority: draft.priority, description: draft.description.trim() || undefined,
      }
      if (isNew) await setupApi.createTaskTemplate(orgId, { code: slug(draft.name) || `checklist_${Date.now()}`, ...body })
      else await setupApi.updateTaskTemplate(orgId, existing, { ...body, description: draft.description.trim() || null })
      invalidate(['task-templates', orgId])
      onSaved(draft.name.trim())
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const fieldErrors = getFieldErrors(error)
  return (
    <form className="panel tt-editor" onSubmit={save}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>{isNew ? 'New service checklist' : `Edit “${existing.title_template}”`}</h2>
      <ErrorBanner error={Object.keys(fieldErrors).length ? null : error} />
      {problem && <div className="alert error">{problem}</div>}
      {!isNew && <p className="muted small">Changes reach the clients you start after this. Checklists already started keep their own items.</p>}

      <div className="grid-3">
        <div className="field">
          <label htmlFor="pb_name">Which service is this? *</label>
          <input id="pb_name" autoFocus required value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. SMM, Local SEO, Technical SEO, Ads" />
          {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
        </div>
        <div className="field">
          <label htmlFor="pb_type">Kind of work</label>
          <select id="pb_type" value={draft.task_type_code} onChange={(e) => set('task_type_code', e.target.value)}>
            {!typeStillOffered && draft.task_type_code && <option value={draft.task_type_code}>{draft.task_type_code}</option>}
            {types.map((t) => <option key={t.code} value={t.code}>{t.name} · {disciplineLabel(t.discipline)}</option>)}
          </select>
          <div className="hint">Only kinds of work with no boxes of their own are offered. Make one under Task types, for example “Service checklist”.</div>
        </div>
        <div className="field">
          <label htmlFor="pb_priority">How urgent</label>
          <select id="pb_priority" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      <section className="tt-block">
        <h3>What has to be done</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Each line becomes a box to tick. “Must be done” items have to be ticked before the task can be handed in.
        </p>
        {draft.items.map((item, index) => (
          <div key={item.id} className="pb-row">
            <span className="pb-no">{index + 1}</span>
            <input aria-label={`Item ${index + 1}`} value={item.text} maxLength={500} placeholder="e.g. Collect brand colours and logo" onChange={(e) => updateItem(item.id, { text: e.target.value })} />
            <label className="inline-check"><input type="checkbox" checked={item.mandatory} onChange={(e) => updateItem(item.id, { mandatory: e.target.checked })} />Must be done</label>
            <button type="button" className="btn secondary small-btn" disabled={index === 0} onClick={() => moveItem(item.id, -1)} aria-label="Move up">↑</button>
            <button type="button" className="btn secondary small-btn" disabled={index === draft.items.length - 1} onClick={() => moveItem(item.id, 1)} aria-label="Move down">↓</button>
            <button type="button" className="btn danger-outline small-btn" onClick={() => removeItem(item.id)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn secondary small-btn" onClick={() => set('items', [...draft.items, { id: rowId(), text: '', mandatory: true }])}>+ Add an item</button>

        <details className="ae-list">
          <summary>Paste a whole list at once</summary>
          <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'One item per line, for example:\nCollect brand colours and logo\nGet access to the social accounts\nMake the 30-day content calendar'} style={{ width: '100%' }} />
          <button type="button" className="btn secondary small-btn" style={{ marginTop: 8 }} disabled={!paste.trim()} onClick={addPasted}>Add these items</button>
        </details>
      </section>

      <div className="field">
        <label htmlFor="pb_desc">Note for the team <span className="muted">(optional)</span></label>
        <textarea id="pb_desc" rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
      </div>

      <div className="row-actions tt-save">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{isNew ? 'Save checklist' : 'Save changes'}</button>
        <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// Starting a checklist for a client: one task for the team, titled with the service and the client.
function StartForm({ orgId, template, names, typeName, initialProject, onClose, onStarted }) {
  const customers = names.customers
  const units = (names.units ?? []).filter((u) => u.status !== 'inactive')
  const [clientId, setClientId] = useState('')
  const [clientText, setClientText] = useState('')
  const [unitId, setUnitId] = useState('')
  // Optionally attach the checklist to a project, so it shows in that project's Tasks.
  const [projectId, setProjectId] = useState(initialProject || '')
  const { data: projects = [] } = useLookup(['projects', orgId, 'options'], ({ signal }) => projectsApi.options(orgId, { signal }))
  const openProjects = projects.filter((p) => !['closed', 'cancelled', 'completed'].includes(p.status))
  const chosenProject = openProjects.find((p) => p.id === projectId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // The team delivery's routing rules give this kind of work.
  const { data: routed } = useLookup(
    ['task-routing', orgId, template.task_type.code, 'none'],
    ({ signal }) => routingApi.route(orgId, template.task_type.code, null, { signal })
  )
  const team = unitId || routed?.unit?.id || ''
  // With a project chosen, its client is the client: nothing more to pick.
  const projectClient = chosenProject
    ? chosenProject.client?.name || customers?.find((c) => c.id === chosenProject.client?.id)?.name || chosenProject.name
    : ''
  const client = projectClient || (customers ? customers.find((c) => c.id === clientId)?.name ?? '' : clientText.trim())

  async function start(e) {
    e.preventDefault()
    if (!client || !team) return
    setError(null)
    setBusy(true)
    try {
      const body = {
        title: `${template.title_template} · ${client}`,
        task_type_code: template.task_type.code,
        priority: template.default_priority,
        checklist: template.checklist.map((i) => ({ text: i.text, mandatory: i.mandatory !== false })),
        labels: [PLAYBOOK_LABEL],
        owning_unit_id: team,
      }
      if (template.description) body.description = template.description
      if (chosenProject) body.subject = { type: SUBJECT_TYPES.project, id: chosenProject.id }
      const task = await tasksApi.create(orgId, body)
      invalidate(['tasks', orgId])
      if (chosenProject) invalidate(['project', orgId, chosenProject.id])
      onStarted(task, client)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel tt-editor" onSubmit={start}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Start “{template.title_template}” for a client</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        The team gets one task with {template.checklist.length} items to tick, as “{typeName}”.
      </p>
      <ErrorBanner error={error} />
      <div className="grid-3">
        {openProjects.length > 0 && (
          <div className="field">
            <label htmlFor="st_project">Project <span className="muted">(optional)</span></label>
            <select id="st_project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not in a project</option>
              {openProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="hint">The checklist then shows in that project’s Tasks.</div>
          </div>
        )}
        <div className="field">
          <label htmlFor="st_client">Client {chosenProject ? '' : '*'}</label>
          {chosenProject ? (
            <input id="st_client" readOnly value={client || '—'} />
          ) : customers ? (
            <select id="st_client" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose the client…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <input id="st_client" required value={clientText} onChange={(e) => setClientText(e.target.value)} placeholder="Client name" />
          )}
        </div>
        <div className="field">
          <label htmlFor="st_team">Which team does it? *</label>
          <select id="st_team" required value={team} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">Choose the team…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {routed?.unit && !unitId && <div className="hint">Filled in from “Who gets the work”.</div>}
        </div>
      </div>
      <div className="row-actions tt-save">
        <button className="btn" type="submit" disabled={busy || !client || !team} aria-busy={busy}>Start the checklist</button>
        <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
