import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { setupApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { formatDateTime, toUpperCode } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

let rowSeq = 0
const rowId = () => `row-${(rowSeq += 1)}`

// A project template's phases and milestones, changed and published as its next version. New
// projects copy the latest published version; projects already made keep what they copied. What
// this page doesn't show (work packages, fixed dates, weights, the template's workflow) is kept.
export default function ProjectTemplateBuilder() {
  const { code } = useParams()
  const { orgId } = useActiveOrg()
  const enabled = Boolean(orgId)
  const names = useDeliveryNames(orgId)
  const templates = useQuery(['project-templates', orgId], ({ signal }) => setupApi.templates(orgId, { signal }), { enabled })
  const versions = useQuery(
    ['project-template-versions', orgId, code],
    ({ signal }) => setupApi.templateVersions(orgId, code, { signal }),
    { enabled }
  )
  const { data: types = [] } = useLookup(['project-types', orgId], ({ signal }) => setupApi.projectTypes(orgId, { signal }), { enabled })
  // Kept here, not in the editor: publishing reloads the versions, which starts a fresh editor.
  const [notice, setNotice] = useState('')

  const template = (templates.data ?? []).find((t) => t.code === code)
  // Just created: the cached list doesn't have it until its refetch lands.
  if (templates.loading || versions.loading || (!template && templates.fetching)) return <PanelSkeleton />
  if (!template) {
    return <ErrorBanner error={templates.error || versions.error || { message: 'This project template doesn’t exist in this company.' }} />
  }
  const all = versions.data ?? []
  // Versions come newest first. Starting from the newest, even a draft, picks up where someone left off.
  const start = all[0] ?? null
  const typeName = types.find((t) => t.code === template.work_unit_type_code)?.name || template.work_unit_type_code

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{template.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Project template <span className="mono">{template.code}</span> · for {typeName.toLowerCase()} projects
            {template.vertical && ` · ${names.verticalName(template.vertical)}`}
            {template.published_version_no ? ` · version ${template.published_version_no} is in use` : ' · not published yet'}
          </p>
        </div>
        <Link className="btn secondary" to="/project-templates">Back to templates</Link>
      </div>
      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={versions.error} onRetry={versions.reload} />

      <Editor
        key={`${code}-${start?.version_no || 0}`}
        orgId={orgId}
        template={template}
        start={start}
        onEdit={() => setNotice('')}
        onPublished={(versionNo) =>
          setNotice(`Version ${versionNo} published. New projects made from “${template.name}” start with it; projects already made keep theirs.`)
        }
      />
      <VersionHistory versions={all} inUse={template.published_version_no} />
    </div>
  )
}

const asList = (value) => (Array.isArray(value) ? value : [])
const bySeq = (a, b) => (a.seq ?? 0) - (b.seq ?? 0)

// The version's structure as editor rows. Milestones point at a phase row, not a number, so
// phases can be moved and removed; `item` keeps every field the page doesn't show.
function fromStructure(structure) {
  const phaseRowBySeq = new Map()
  const phases = [...asList(structure.phases)].sort(bySeq).map((item) => {
    const row = { id: rowId(), name: item.name ?? '', item }
    // As the backend copies them: a phase without a seq is phase 0.
    phaseRowBySeq.set(item.seq ?? 0, row.id)
    return row
  })
  const phaseRow = (phaseSeq) => (phaseSeq == null ? '' : phaseRowBySeq.get(phaseSeq) ?? '')
  const milestones = [...asList(structure.milestones)].sort(bySeq).map((item) => ({
    id: rowId(),
    name: item.name ?? '',
    code: item.code ?? '',
    codeEdited: true,
    phase: phaseRow(item.phase_seq),
    is_billing_milestone: Boolean(item.is_billing_milestone),
    requires_client_acceptance: Boolean(item.requires_client_acceptance),
    item,
  }))
  return { phases, milestones, phaseRowBySeq }
}

// Editor rows back to a structure: phases numbered 1..n in their order, and everything that
// points at a phase (milestones, the work packages carried over) pointed at its new number.
function toStructure(original, phases, milestones, phaseRowBySeq) {
  const seqByRow = new Map(phases.map((p, i) => [p.id, i + 1]))
  const inPhase = (item, row) => {
    const out = { ...item }
    delete out.phase_seq
    if (seqByRow.has(row)) out.phase_seq = seqByRow.get(row)
    return out
  }
  const structure = {
    ...original,
    phases: phases.map((p, i) => ({ ...p.item, seq: i + 1, name: p.name.trim() })),
    milestones: milestones.map((m, i) =>
      inPhase(
        {
          ...m.item,
          seq: i + 1,
          code: m.code.trim(),
          name: m.name.trim(),
          is_billing_milestone: m.is_billing_milestone,
          requires_client_acceptance: m.requires_client_acceptance,
        },
        m.phase
      )
    ),
  }
  if (Array.isArray(original.packages)) {
    structure.packages = original.packages.map((p) => inPhase(p, phaseRowBySeq.get(p.phase_seq)))
  }
  return structure
}

// What would make a template that projects can't use, said before publishing.
function problems(phases, milestones) {
  const found = []
  if (phases.length === 0 && milestones.length === 0) found.push('Add at least one phase or milestone.')
  if (phases.some((p) => !p.name.trim())) found.push('Every phase needs a name.')
  if (milestones.some((m) => !m.name.trim())) found.push('Every milestone needs a name.')
  const codes = milestones.map((m) => m.code.trim())
  if (codes.some((c) => !c)) found.push('Every milestone needs a code.')
  if (new Set(codes).size !== codes.length) found.push('Two milestones have the same code.')
  return found
}

function uniqueCode(base, taken) {
  if (!base) return ''
  let candidate = base
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}-${n}`
  return candidate
}

function moveRow(rows, id, delta) {
  const from = rows.findIndex((r) => r.id === id)
  const to = from + delta
  if (to < 0 || to >= rows.length) return rows
  const next = [...rows]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

function Editor({ orgId, template, start, onEdit, onPublished }) {
  const original = start?.structure ?? {}
  const [initial] = useState(() => fromStructure(original))
  const [phases, setPhases] = useState(initial.phases)
  const [milestones, setMilestones] = useState(initial.milestones)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const found = problems(phases, milestones)
  // An unchanged draft is published as it is; anything else becomes the next version first.
  const reuseDraft = !dirty && start?.status === 'draft'
  const canPublish = found.length === 0 && (dirty || reuseDraft)
  const nextVersionNo = reuseDraft ? start.version_no : (start?.version_no ?? 0) + 1
  const packages = asList(original.packages)

  function touch() {
    setDirty(true)
    onEdit()
  }
  const setPhase = (id, changes) => {
    touch()
    setPhases((all) => all.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }
  const setMilestone = (id, changes) => {
    touch()
    setMilestones((all) => all.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }

  function addPhase() {
    touch()
    setPhases((all) => [...all, { id: rowId(), name: '', item: {} }])
  }

  function removePhase(id) {
    touch()
    setPhases((all) => all.filter((p) => p.id !== id))
    setMilestones((all) => all.map((m) => (m.phase === id ? { ...m, phase: '' } : m)))
  }

  function addMilestone() {
    touch()
    setMilestones((all) => [
      ...all,
      { id: rowId(), name: '', code: '', codeEdited: false, phase: '', is_billing_milestone: false, requires_client_acceptance: false, item: {} },
    ])
  }

  function renameMilestone(milestone, name) {
    const taken = new Set(milestones.filter((m) => m.id !== milestone.id).map((m) => m.code))
    setMilestone(milestone.id, { name, ...(milestone.codeEdited ? {} : { code: uniqueCode(toUpperCode(name), taken) }) })
  }

  function move(setter, id, delta) {
    touch()
    setter((rows) => moveRow(rows, id, delta))
  }

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      let versionNo = start?.version_no
      if (!reuseDraft) {
        const draft = await setupApi.createTemplateVersion(orgId, template.code, {
          structure: toStructure(original, phases, milestones, initial.phaseRowBySeq),
          ...(start?.workflow_definition_code ? { workflow_definition_code: start.workflow_definition_code } : {}),
        })
        versionNo = draft.version_no
      }
      await setupApi.publishTemplateVersion(orgId, template.code, versionNo)
      invalidate(['project-templates', orgId])
      invalidate(['project-template-versions', orgId, template.code])
      onPublished(versionNo)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {start?.status === 'draft' && (
        <div className="alert info">Version {start.version_no} is a draft that was never published. Publish it as it is, or change it first.</div>
      )}
      <ErrorBanner error={error} />

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Phases</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          The stages of the work, in order. Optional: a template can be milestones only.
        </p>
        {phases.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Phase</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {phases.map((p, i) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td>{i + 1}</td>
                    <td>
                      <input aria-label="Phase name" placeholder="e.g. Design" maxLength={255} value={p.name} onChange={(e) => setPhase(p.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn secondary small-btn" disabled={i === 0} onClick={() => move(setPhases, p.id, -1)} aria-label="Move up">↑</button>
                        <button type="button" className="btn secondary small-btn" disabled={i === phases.length - 1} onClick={() => move(setPhases, p.id, 1)} aria-label="Move down">↓</button>
                        <button type="button" className="btn danger-outline small-btn" onClick={() => removePhase(p.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addPhase}>+ Add a phase</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Milestones</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          What each project made from this template must deliver, in order. Each starts planned for the project’s due date;
          set its forecast on the project’s Milestones tab.
        </p>
        {milestones.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Milestone</th>
                  <th>Code</th>
                  <th>Phase</th>
                  <th>Invoiced on completion</th>
                  <th>Customer signs off</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={m.id} style={{ cursor: 'default' }}>
                    <td>{i + 1}</td>
                    <td>
                      <input aria-label="Milestone name" placeholder="e.g. Designs approved" maxLength={255} value={m.name} onChange={(e) => renameMilestone(m, e.target.value)} />
                    </td>
                    <td>
                      <input
                        aria-label="Milestone code"
                        className="mono-input"
                        maxLength={100}
                        value={m.code}
                        onChange={(e) => setMilestone(m.id, { code: e.target.value, codeEdited: true })}
                      />
                    </td>
                    <td>
                      <select aria-label="Phase" value={m.phase} onChange={(e) => setMilestone(m.id, { phase: e.target.value })}>
                        <option value="">— None —</option>
                        {phases.map((p, n) => <option key={p.id} value={p.id}>{p.name.trim() || `Phase ${n + 1}`}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Invoiced on completion"
                        checked={m.is_billing_milestone}
                        onChange={(e) => setMilestone(m.id, { is_billing_milestone: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Customer signs off"
                        checked={m.requires_client_acceptance}
                        onChange={(e) => setMilestone(m.id, { requires_client_acceptance: e.target.checked })}
                      />
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn secondary small-btn" disabled={i === 0} onClick={() => move(setMilestones, m.id, -1)} aria-label="Move up">↑</button>
                        <button type="button" className="btn secondary small-btn" disabled={i === milestones.length - 1} onClick={() => move(setMilestones, m.id, 1)} aria-label="Move down">↓</button>
                        <button
                          type="button"
                          className="btn danger-outline small-btn"
                          onClick={() => {
                            touch()
                            setMilestones((all) => all.filter((x) => x.id !== m.id))
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addMilestone}>+ Add a milestone</button>
      </div>

      {(packages.length > 0 || start?.workflow_definition_code) && (
        <p className="muted small">
          Kept as they are:
          {packages.length > 0 && ` ${packages.length} work package${packages.length === 1 ? '' : 's'}`}
          {packages.length > 0 && start?.workflow_definition_code && ' and'}
          {start?.workflow_definition_code && <> the workflow <span className="mono">{start.workflow_definition_code}</span></>}.
        </p>
      )}
      {(dirty || reuseDraft) && found.length > 0 && (
        <div className="alert warn">
          {found.map((p) => <div key={p}>{p}</div>)}
        </div>
      )}
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button className="btn" disabled={busy || !canPublish} aria-busy={busy} onClick={publish}>
          Publish as version {nextVersionNo}
        </button>
        {!dirty && !start && <span className="muted small">Add its phases and milestones, then publish.</span>}
        {!dirty && start && !reuseDraft && <span className="muted small">Change something to publish a new version.</span>}
      </div>
    </>
  )
}

function VersionHistory({ versions, inUse }) {
  if (versions.length === 0) return null
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Versions</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        New projects copy the version in use. A project keeps what it copied, whatever happens to the template later.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Published</th>
              <th>Phases</th>
              <th>Milestones</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} style={{ cursor: 'default' }}>
                <td>
                  {v.version_no}
                  {v.version_no === inUse && <span className="muted small"> · in use</span>}
                </td>
                <td><StatusBadge status={v.status} label={v.status === 'published' ? 'Published' : v.status === 'draft' ? 'Draft' : 'Retired'} /></td>
                <td>{formatDateTime(v.published_at)}</td>
                <td>{asList(v.structure?.phases).length}</td>
                <td>{asList(v.structure?.milestones).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
