// Department operations setup with no React in it (tested in tests/department_setup.test.mjs).
// `runSetup` writes through the `api` it is given, so a test hands it an in-memory stand-in and the
// screen hands it the real delivery calls. Every step looks first and never overwrites.

export const typeCodeOf = (template) => template.code.replace(/-/g, '_')
const norm = (text) => (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// The company's team whose name matches the hint ("SEO" matches "SEO team"), if exactly one does.
export function guessUnit(units, hint) {
  const wanted = norm(hint)
  if (!wanted) return ''
  const exact = units.filter((u) => norm(u.name) === wanted)
  if (exact.length === 1) return exact[0].id
  const partial = units.filter((u) => norm(u.name).includes(wanted) || wanted.includes(norm(u.name)))
  return partial.length === 1 ? partial[0].id : ''
}

// The first published version of a template: each stage that belongs to another team carries it.
export function versionContent(template, stageTeams) {
  return {
    stages: template.stages.map((s, i) => ({
      ...s,
      seq: i + 1,
      ...(stageTeams[s.code] ? { owner_unit_selector: { unit_id: stageTeams[s.code] } } : {}),
    })),
    transitions: template.steps.map((s) => ({ ...s, trigger_type: 'manual' })),
  }
}

// What must be fixed before anything is written.
export function setupProblems({ template, home, stageTeams, typeCode, typeName, existingType }) {
  const stageName = (code) => template.stages.find((s) => s.code === code)?.name || code
  const problems = []
  if (!home) problems.push('Choose the team that does this work.')
  Object.keys(template.teams || {}).forEach((code) => {
    if (!stageTeams[code]) problems.push(`Choose the team for “${stageName(code)}”.`)
  })
  if (typeCode === 'new' && !typeName.trim()) problems.push('Give the new task type a name.')
  if (existingType?.workflow && existingType.workflow.code !== template.code) {
    problems.push(`“${existingType.name}” already follows “${existingType.workflow.name}”. Choose another type, or a new one.`)
  }
  if (existingType && existingType.outcomes?.length > 0 && !existingType.workflow) {
    problems.push(`“${existingType.name}” records outcomes, so it can’t follow a workflow yet. Choose another type, or a new one.`)
  }
  return problems
}

const handled = (message) => Object.assign(new Error(message), { handled: true })

// The steps, in order. `note(key, state, text)` reports each one (state: running, done, kept, failed).
// Returns { ok, typeCode }; throws the API's error when a call fails (`err.handled` = already reported).
// Safe to run again after any failure: it carries on from what is there.
export async function runSetup({ api, template, home, stageTeams, typeCode, typeName, route, unitName, note }) {
  // 1. the workflow
  note('workflow', 'running', 'Saving the workflow…')
  const defs = await api.definitions()
  const def = defs.find((d) => d.code === template.code)
  if (def?.current_version_no) {
    note('workflow', 'kept', `The workflow “${def.name}” is already published, so it was left as it is. Stage teams were not changed: use “Change it” to set them.`)
  } else {
    if (!def) await api.createDefinition({ code: template.code, name: template.name, subject_type: 'task.task' })
    // A half-made workflow (made, never published): publish its draft instead of making a second one.
    const versions = def ? await api.versions(template.code) : []
    const draft = versions.find((v) => v.status === 'draft')
    const version = draft ?? (await api.createVersion(template.code, versionContent(template, stageTeams)))
    await api.publishVersion(template.code, version.version_no)
    note('workflow', 'done', draft ? 'The unfinished workflow was published.' : 'The workflow is saved and published, with its stage teams.')
  }

  // 2. the task type
  note('type', 'running', 'Checking the task type…')
  const code = typeCode === 'new' ? typeCodeOf(template) : typeCode
  let type = (await api.taskTypes()).find((t) => t.code === code)
  if (type) {
    note('type', 'kept', `The task type “${type.name}” is used as it is.`)
  } else {
    await api.createTaskType({
      code,
      name: typeName.trim(),
      discipline: template.discipline,
      estimation_unit: 'minutes',
      requires_review: false,
      fields: [],
      outcomes: [],
      response_sla_minutes: null,
      resolution_sla_minutes: null,
    })
    type = (await api.taskTypes()).find((t) => t.code === code)
    note('type', 'done', `The task type “${typeName.trim()}” was made.`)
  }

  // 3. the link
  note('link', 'running', 'Linking the task type to the workflow…')
  if (type.workflow?.code === template.code) {
    note('link', 'kept', 'The task type already follows this workflow.')
  } else if (type.workflow) {
    note('link', 'failed', `The task type already follows “${type.workflow.name}”. It was not changed.`)
    throw handled('linked elsewhere')
  } else {
    await api.setTypeWorkflow(type.id, template.code)
    note('link', 'done', 'New tasks of this type now follow the workflow.')
  }

  // 4. the routing rule
  if (!route) {
    note('route', 'kept', 'No routing rule was asked for: tasks keep the team they are given.')
  } else {
    note('route', 'running', 'Setting who gets the work…')
    const rule = (await api.rules()).find((r) => r.task_type_code === type.code && r.active && !r.vertical)
    if (rule) {
      note('route', 'kept', rule.unit?.id === home ? 'A rule already sends this work to that team.' : `A rule already sends this work to ${unitName(rule.unit?.id)}. It was not changed.`)
    } else {
      await api.createRule({ task_type_code: type.code, unit_id: home, accepts_requests: false })
      note('route', 'done', `Work of this type now goes to ${unitName(home)}.`)
    }
  }

  // 5. read it all back
  note('check', 'running', 'Checking everything…')
  const bad = []
  const def2 = (await api.definitions()).find((d) => d.code === template.code)
  if (!def2?.current_version_no) bad.push('the workflow is not published')
  const type2 = (await api.taskTypes()).find((t) => t.code === type.code)
  if (type2?.workflow?.code !== template.code) bad.push('the task type does not follow the workflow')
  if (route) {
    const where = await api.route(type.code)
    const unitId = where?.unit?.id ?? where?.unit
    if (unitId !== home) bad.push(`the work goes to ${unitId ? unitName(unitId) : 'no team'}, not ${unitName(home)}`)
  }
  if (bad.length) {
    note('check', 'failed', `Not right yet: ${bad.join('; ')}.`)
    return { ok: false, typeCode: type.code }
  }
  note('check', 'done', 'Everything checks out.')
  return { ok: true, typeCode: type.code }
}

// ---------- Readiness ----------
// For one operation: what is configured, missing, not applicable or unsupported. "Ready" needs every
// applicable item configured; items the backend can't hold yet are shown as unsupported, never as done.
//
// ctx: { units, types, definitions, version (published content of the workflow, or null), rules,
//        policies ([{ unit, policy }]), templates (the checklists: [{ task_type, checklist }]) }
// Each row: { key, label, state: 'configured' | 'missing' | 'not_applicable' | 'unsupported', text, fix? }
export function readiness(template, ctx) {
  const code = typeCodeOf(template)
  const rows = []
  const add = (key, label, state, text, fix) => rows.push({ key, label, state, text, ...(fix ? { fix } : {}) })

  const type = ctx.types.find((t) => t.code === code && !t.archived)
  const def = ctx.definitions.find((d) => d.code === template.code)
  const rule = type ? ctx.rules.find((r) => r.task_type_code === type.code && r.active && !r.vertical) : null
  const homeGuess = guessUnit(ctx.units, template.home)
  const unitLabel = (id) => ctx.units.find((u) => u.id === id)?.name || 'a team'

  // Department and team: the rule's team, else a team found by the department's name.
  if (rule?.unit?.id) add('team', 'Department and team', 'configured', `${unitLabel(rule.unit.id)} does this work.`)
  else if (homeGuess) add('team', 'Department and team', 'configured', `${unitLabel(homeGuess)} found by name; confirm it when setting up.`)
  else add('team', 'Department and team', 'missing', `No team called “${template.home}” was found. Add it under Company structure.`, { to: '/org-units', label: 'Company structure' })

  add('type', 'Task type', type ? 'configured' : 'missing', type ? `“${type.name}”.` : 'No task type for this operation yet.')

  if (def?.current_version_no) add('workflow', 'Workflow', 'configured', `Published (version ${def.current_version_no}).`)
  else if (def) add('workflow', 'Workflow', 'missing', 'Made but not published.')
  else add('workflow', 'Workflow', 'missing', 'Not installed.')

  const hinted = Object.keys(template.teams || {})
  if (hinted.length === 0) add('stageTeams', 'Stage team mapping', 'not_applicable', 'Every stage stays with the task’s own team.')
  else if (!def?.current_version_no) add('stageTeams', 'Stage team mapping', 'missing', 'Needs the workflow first.')
  else if (!ctx.version) add('stageTeams', 'Stage team mapping', 'missing', 'Could not read the published stages.')
  else {
    const unmapped = hinted.filter((s) => !ctx.version.stages?.find((x) => x.code === s)?.owner_unit_selector?.unit_id)
    if (unmapped.length) {
      const names = unmapped.map((s) => template.stages.find((x) => x.code === s)?.name || s).join(', ')
      add('stageTeams', 'Stage team mapping', 'missing', `No team yet for: ${names}.`, { to: `/task-workflows/${template.code}`, label: 'Change it' })
    } else add('stageTeams', 'Stage team mapping', 'configured', 'Each stage that belongs to another team has one.')
  }

  add('routing', 'Routing rule', rule ? 'configured' : 'missing', rule ? `Goes to ${unitLabel(rule.unit?.id)}.` : 'No rule sends this work to a team.', rule ? null : { to: '/task-types?tab=routing', label: 'Who gets the work' })

  if (!rule?.unit?.id) add('assignment', 'Assignment', 'missing', 'Needs a routing rule first.')
  else {
    const policy = ctx.policies.find((p) => (p.unit?.id ?? p.unit) === rule.unit.id)?.policy
    add('assignment', 'Assignment', 'configured', !policy || policy === 'queue' ? 'Waits in the team’s queue until someone takes it.' : policy === 'round_robin' ? 'Handed out in turn.' : 'Handed to the least busy person.')
  }

  const checklist = type ? ctx.templates.find((t) => (t.task_type?.code ?? t.task_type_code) === type.code && (t.checklist?.length ?? 0) > 0) : null
  add('checklist', 'Checklist', checklist ? 'configured' : 'missing', checklist ? `${checklist.checklist.length} items.` : 'No checklist for this kind of work.', checklist ? null : { to: '/playbooks', label: 'Checklists' })

  const reviewStages = template.stages.filter((s) => s.status_category === 'in_review')
  if (reviewStages.length === 0) add('reviewer', 'Reviewer', 'not_applicable', 'No stage is a review.')
  else add('reviewer', 'Reviewer', 'unsupported', `Anyone holding the review permission can pass “${reviewStages[0].name}”. Naming who checks each stage is not supported yet.`)

  const approvalStages = template.stages.filter((s) => /approv/i.test(s.name) && s.stage_type !== 'end')
  if (approvalStages.length === 0) add('approval', 'Approval', 'not_applicable', 'No stage asks for approval.')
  else add('approval', 'Approval', 'unsupported', `“${approvalStages[0].name}” is a review stage. A formal approval policy per stage is not supported yet.`)

  const sla = type && (type.response_sla_minutes || type.resolution_sla_minutes)
  add('sla', 'Time limit (SLA)', sla ? 'configured' : 'missing', sla ? 'Set on the task type. Per-stage limits are not supported yet.' : 'No time limit on the task type.', sla ? null : { to: '/task-types', label: 'Task types' })

  const missing = rows.filter((r) => r.state === 'missing')
  const unsupported = rows.filter((r) => r.state === 'unsupported')
  const status = missing.length ? 'not_ready' : unsupported.length ? 'ready_with_limits' : 'ready'
  return { rows, missing: missing.length, unsupported: unsupported.length, status }
}

export const READINESS_LABELS = {
  not_ready: 'Not ready',
  ready_with_limits: 'Ready, with limits',
  ready: 'Ready',
}
