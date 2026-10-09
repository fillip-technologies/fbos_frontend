import { customersApi } from '@/features/customers/api.js'
import { api } from '@/shared/api/http.js'
import { DELIVERY, IDENTITY, REVENUE } from '@/shared/api/paths.js'
import { inOrg, listAll, pageQuery } from '@/shared/api/query.js'

const ifMatch = (orgId, version) => inOrg(orgId, { 'If-Match': `"${version}"` })
// Milestones, change requests and handovers carry no version: the backend only asks that
// If-Match is present, so "*" (any version) states the change is meant for what's there.
const anyVersion = (orgId) => inOrg(orgId, { 'If-Match': '*' })

// ---------- Projects (the backend's "work units") ----------
export const projectsApi = {
  // Filters: status, health, manager_user_id, client_id, owning_unit_id, vertical_id, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/work-units?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/work-units/${id}`, { headers: inOrg(orgId), signal }),
  // Every project, to pick one (a task's project, a timesheet entry's).
  options: (orgId, { signal } = {}) => listAll(`${DELIVERY}/work-units`, orgId, {}, { signal }),
  // { work_unit, phases, milestones, tasks_by_status, risks_open, pending_approvals }
  summary: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/work-units/${id}/summary`, { headers: inOrg(orgId), signal }),
  progress: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/work-units/${id}/progress`, { headers: inOrg(orgId), signal }),
  // { template_code | work_unit_type_code, name, owning_unit_id, manager_user_id, planned_start, planned_end, ... }
  create: (orgId, body) => api.post(`${DELIVERY}/work-units`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) => api.patch(`${DELIVERY}/work-units/${id}`, body, { headers: ifMatch(orgId, version) }),
  // { to_status, reason, effective_on? }
  changeStatus: (orgId, project, body) =>
    api.post(`${DELIVERY}/work-units/${project.id}/status`, body, { headers: ifMatch(orgId, project.version) }),
  members: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/work-units/${id}/members`, { headers: inOrg(orgId), signal }),
  replaceMembers: (orgId, project, members) =>
    api.put(`${DELIVERY}/work-units/${project.id}/members`, { members }, { headers: ifMatch(orgId, project.version) }),
  milestones: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/work-units/${id}/milestones`, orgId, {}, { signal }),
  addMilestone: (orgId, id, body) => api.post(`${DELIVERY}/work-units/${id}/milestones`, body, { headers: inOrg(orgId) }),
  risks: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/work-units/${id}/risks`, orgId, {}, { signal }),
  addRisk: (orgId, id, body) => api.post(`${DELIVERY}/work-units/${id}/risks`, body, { headers: inOrg(orgId) }),
  changeRequests: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/work-units/${id}/change-requests`, orgId, {}, { signal }),
  addChangeRequest: (orgId, id, body) => api.post(`${DELIVERY}/work-units/${id}/change-requests`, body, { headers: inOrg(orgId) }),
}

// ---------- Milestones: pending → submitted → accepted / completed, or rejected ----------
export const milestonesApi = {
  update: (orgId, id, body) => api.patch(`${DELIVERY}/milestones/${id}`, body, { headers: anyVersion(orgId) }),
  submit: (orgId, id, body = { deliverable_document_ids: [] }) =>
    api.post(`${DELIVERY}/milestones/${id}/submit`, body, { headers: anyVersion(orgId) }),
  // { accepted_by_name, accepted_on, note? }
  accept: (orgId, id, body) => api.post(`${DELIVERY}/milestones/${id}/accept`, body, { headers: anyVersion(orgId) }),
  reject: (orgId, id, body) => api.post(`${DELIVERY}/milestones/${id}/reject`, body, { headers: anyVersion(orgId) }),
}

export const risksApi = {
  update: (orgId, id, body) => api.patch(`${DELIVERY}/risks/${id}`, body, { headers: inOrg(orgId) }),
}

// ---------- Change requests: draft → submitted → approved / rejected ----------
export const changeRequestsApi = {
  submit: (orgId, id) => api.post(`${DELIVERY}/change-requests/${id}/submit`, undefined, { headers: anyVersion(orgId) }),
  approve: (orgId, id, body = {}) => api.post(`${DELIVERY}/change-requests/${id}/approve`, body, { headers: anyVersion(orgId) }),
  reject: (orgId, id, body) => api.post(`${DELIVERY}/change-requests/${id}/reject`, body, { headers: anyVersion(orgId) }),
}

// ---------- Tasks ----------
const taskAction = (action) => (orgId, task, body) =>
  api.post(`${DELIVERY}/tasks/${task.id}/${action}`, body, { headers: ifMatch(orgId, task.version) })

export const tasksApi = {
  // Filters (list, board and queue alike): assignee ('me' or a user id), unassigned, status, priority,
  // owning_unit_id, subject_type, subject_id, work_unit_id, task_type (codes), discipline, overdue, q.
  list: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/tasks?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  // { group_by, columns: [{ key, label, statuses, count, tasks, has_more }] }
  // group_by: status | assignee | priority | task_type; per_column; done_within_days.
  board: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/tasks/board?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  // What to work next, nearest due first: { data, total }. unassigned=true lists a team's pool to claim from.
  queue: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/tasks/queue?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/tasks/${id}`, { headers: inOrg(orgId), signal }),
  // The signed-in user's own open work: { assigned_open, due_today, overdue }.
  mySummary: (orgId, { signal } = {}) => api.get(`${DELIVERY}/tasks/summary`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${DELIVERY}/tasks`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, version, body) => api.patch(`${DELIVERY}/tasks/${id}`, body, { headers: ifMatch(orgId, version) }),
  assign: taskAction('assign'),
  // Take an unassigned task from the team's queue.
  claim: taskAction('claim'),
  start: taskAction('start'),
  block: taskAction('block'),
  unblock: taskAction('unblock'),
  // { note?, outcome?, attributes?, follow_up_at?, skip_follow_up? } — the type says which outcome and fields it needs.
  submit: taskAction('submit'),
  cancel: taskAction('cancel'),
  // { result: 'pass' | 'fail', rating?, feedback? } — fail needs feedback.
  review: (orgId, id, body) => api.post(`${DELIVERY}/tasks/${id}/reviews`, body, { headers: inOrg(orgId) }),
  reviews: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/reviews`, orgId, {}, { signal }),
  // Everyone the task was given to (assignees, reviewers), until when and why it ended.
  assignments: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/assignments`, orgId, {}, { signal }),
  tickChecklistItem: (orgId, taskId, itemId, done) =>
    api.patch(`${DELIVERY}/tasks/${taskId}/checklist/${itemId}`, { done }, { headers: inOrg(orgId) }),
  history: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/history`, orgId, {}, { signal }),
  comments: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/comments`, orgId, {}, { signal }),
  addComment: (orgId, id, body) => api.post(`${DELIVERY}/tasks/${id}/comments`, body, { headers: inOrg(orgId) }),
  // The tasks this one waits for; `dependents` the ones waiting for it.
  dependencies: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/dependencies`, orgId, {}, { signal }),
  dependents: (orgId, id, { signal } = {}) =>
    listAll(`${DELIVERY}/tasks/${id}/dependencies`, orgId, { direction: 'blocks' }, { signal }),
  // A task whose type follows a workflow (task.governing_workflow) moves by the workflow's steps:
  // [{ code, name, to_stage, requires_approval, allowed, blocked_reasons }] from its stage.
  steps: (orgId, id, { signal } = {}) => listAll(`${DELIVERY}/tasks/${id}/transitions`, orgId, {}, { signal }),
  // Answers with the task. `reason` goes with the step (to the assignee when work goes back from review).
  takeStep: (orgId, task, transitionCode, reason) =>
    api.post(
      `${DELIVERY}/tasks/${task.id}/transitions`,
      { transition_code: transitionCode, ...(reason ? { reason } : {}) },
      { headers: ifMatch(orgId, task.version) }
    ),
  addDependency: (orgId, id, dependsOnTaskId) =>
    api.post(`${DELIVERY}/tasks/${id}/dependencies`, { depends_on_task_id: dependsOnTaskId }, { headers: inOrg(orgId) }),
  removeDependency: (orgId, id, dependsOnTaskId) =>
    api.del(`${DELIVERY}/tasks/${id}/dependencies/${dependsOnTaskId}`, { headers: inOrg(orgId) }),
}

// ---------- Time: logged against a task; the timesheet lists a period ----------
export const timeApi = {
  forTask: (orgId, taskId, { signal } = {}) => listAll(`${DELIVERY}/tasks/${taskId}/time-entries`, orgId, {}, { signal }),
  // { work_date, minutes, billable?, note? }
  log: (orgId, taskId, body) => api.post(`${DELIVERY}/tasks/${taskId}/time-entries`, body, { headers: inOrg(orgId) }),
  // { date_from, date_to, user_id? } — another user's time needs delivery.time_entry.read.
  timesheet: (orgId, params, { signal } = {}) => listAll(`${DELIVERY}/time-entries`, orgId, params, { signal }),
  remove: (orgId, id) => api.del(`${DELIVERY}/time-entries/${id}`, { headers: inOrg(orgId) }),
}

// ---------- Handovers: one unit passes a task or project to another ----------
export const handoversApi = {
  // Filters: to_unit_id (incoming), from_unit_id (outgoing), status (one or many), subject_type, subject_id.
  list: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/handovers?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  get: (orgId, id, { signal } = {}) => api.get(`${DELIVERY}/handovers/${id}`, { headers: inOrg(orgId), signal }),
  // { subject: { type: 'task.task' | 'work.work_unit', id }, from_unit_id, to_unit_id, reason, notes? }
  request: (orgId, body) => api.post(`${DELIVERY}/handovers`, body, { headers: inOrg(orgId) }),
  accept: (orgId, id, body = {}) => api.post(`${DELIVERY}/handovers/${id}/accept`, body, { headers: anyVersion(orgId) }),
  reject: (orgId, id, body) => api.post(`${DELIVERY}/handovers/${id}/reject`, body, { headers: anyVersion(orgId) }),
  // The sending side withdraws one nobody has answered: { reason }.
  cancel: (orgId, id, body) => api.post(`${DELIVERY}/handovers/${id}/cancel`, body, { headers: anyVersion(orgId) }),
}

// ---------- Workflows: versioned stage graphs, run per record ----------
const instance = (id) => `${DELIVERY}/workflow/instances/${id}`

export const workflowsApi = {
  // Ready-made task workflows: [{ code, name, discipline, summary, stages: [{ code, name, status_category }], steps }].
  templates: (orgId, { signal } = {}) => api.get(`${DELIVERY}/workflow/templates`, { headers: inOrg(orgId), signal }),
  // Makes one the company's own task workflow, published: { code?, name? } -> the definition.
  installTemplate: (orgId, code, body = {}) =>
    api.post(`${DELIVERY}/workflow/templates/${code}/install`, body, { headers: inOrg(orgId) }),
  // Filters: subject_type, vertical_id.
  definitions: (orgId, opts = {}, { signal } = {}) => listAll(`${DELIVERY}/workflow/definitions`, orgId, opts, { signal }),
  createDefinition: (orgId, body) => api.post(`${DELIVERY}/workflow/definitions`, body, { headers: inOrg(orgId) }),
  createVersion: (orgId, code, content) =>
    api.post(`${DELIVERY}/workflow/definitions/${code}/versions`, content, { headers: inOrg(orgId) }),
  replaceVersion: (orgId, code, versionNo, content) =>
    api.put(`${DELIVERY}/workflow/definitions/${code}/versions/${versionNo}`, content, { headers: anyVersion(orgId) }),
  validateVersion: (orgId, code, versionNo) =>
    api.post(`${DELIVERY}/workflow/definitions/${code}/versions/${versionNo}/validate`, undefined, { headers: inOrg(orgId) }),
  publishVersion: (orgId, code, versionNo) =>
    api.post(`${DELIVERY}/workflow/definitions/${code}/versions/${versionNo}/publish`, undefined, { headers: anyVersion(orgId) }),
  // Filters: subject_type, subject_id, status, definition_code.
  instances: (orgId, opts = {}, { signal } = {}) => listAll(`${DELIVERY}/workflow/instances`, orgId, opts, { signal }),
  instance: (orgId, id, { signal } = {}) => api.get(instance(id), { headers: inOrg(orgId), signal }),
  // { definition_code, subject: { type, id }, context? }
  start: (orgId, body) => api.post(`${DELIVERY}/workflow/instances`, body, { headers: inOrg(orgId) }),
  // [{ code, name, to_stage, requires_approval, allowed, blocked_reasons }]
  availableTransitions: (orgId, id, { signal } = {}) => listAll(`${instance(id)}/transitions`, orgId, {}, { signal }),
  // { transition_code, reason?, context_patch? } -> { outcome, instance, approval_request_id? }
  transition: (orgId, run, body) => api.post(`${instance(run.id)}/transitions`, body, { headers: ifMatch(orgId, run.version) }),
  hold: (orgId, run, reason) => api.post(`${instance(run.id)}/hold`, { reason }, { headers: ifMatch(orgId, run.version) }),
  resume: (orgId, run) => api.post(`${instance(run.id)}/resume`, undefined, { headers: ifMatch(orgId, run.version) }),
  cancel: (orgId, run, reason) => api.post(`${instance(run.id)}/cancel`, { reason }, { headers: ifMatch(orgId, run.version) }),
  history: (orgId, id, { signal } = {}) => listAll(`${instance(id)}/history`, orgId, {}, { signal }),
}

// ---------- Setup: project types and templates, task types and templates ----------
export const setupApi = {
  projectTypes: (orgId, { signal } = {}) => listAll(`${DELIVERY}/work-unit-types`, orgId, {}, { signal }),
  createProjectType: (orgId, body) => api.post(`${DELIVERY}/work-unit-types`, body, { headers: inOrg(orgId) }),
  updateProjectType: (orgId, id, body) => api.patch(`${DELIVERY}/work-unit-types/${id}`, body, { headers: inOrg(orgId) }),
  templates: (orgId, { signal } = {}) => listAll(`${DELIVERY}/templates`, orgId, {}, { signal }),
  createTemplate: (orgId, body) => api.post(`${DELIVERY}/templates`, body, { headers: inOrg(orgId) }),
  templateVersions: (orgId, code, { signal } = {}) => listAll(`${DELIVERY}/templates/${code}/versions`, orgId, {}, { signal }),
  createTemplateVersion: (orgId, code, body) => api.post(`${DELIVERY}/templates/${code}/versions`, body, { headers: inOrg(orgId) }),
  publishTemplateVersion: (orgId, code, versionNo) =>
    api.post(`${DELIVERY}/templates/${code}/versions/${versionNo}/publish`, undefined, { headers: anyVersion(orgId) }),
  // Built-in and own task types, each with its discipline, fields, outcomes and SLA targets.
  taskTypes: (orgId, { signal } = {}) => listAll(`${DELIVERY}/task-types`, orgId, { include_archived: 'true' }, { signal }),
  createTaskType: (orgId, body) => api.post(`${DELIVERY}/task-types`, body, { headers: inOrg(orgId) }),
  updateTaskType: (orgId, id, body) => api.patch(`${DELIVERY}/task-types/${id}`, body, { headers: inOrg(orgId) }),
  // The company's task workflow new tasks of a type follow; null: none. Answers with the type.
  setTypeWorkflow: (orgId, id, definitionCode) =>
    api.put(`${DELIVERY}/task-types/${id}/workflow`, { definition_code: definitionCode }, { headers: inOrg(orgId) }),
  taskTemplates: (orgId, { signal } = {}) => listAll(`${DELIVERY}/task-templates`, orgId, {}, { signal }),
  createTaskTemplate: (orgId, body) => api.post(`${DELIVERY}/task-templates`, body, { headers: inOrg(orgId) }),
  updateTaskTemplate: (orgId, template, body) =>
    api.patch(`${DELIVERY}/task-templates/${template.id}`, body, { headers: ifMatch(orgId, template.version) }),
  // The company's delivery settings: each is off until turned on. Version 0 = never changed.
  settings: (orgId, { signal } = {}) => api.get(`${DELIVERY}/settings`, { headers: inOrg(orgId), signal }),
  updateSettings: (orgId, settings, body) => api.patch(`${DELIVERY}/settings`, body, { headers: ifMatch(orgId, settings.version) }),
  // How each team hands out work left in its queue: { data: [{ unit, policy, version }] }; a team not listed keeps it queued.
  assignmentPolicies: (orgId, { signal } = {}) => api.get(`${DELIVERY}/assignment-policies`, { headers: inOrg(orgId), signal }),
  // policy: 'queue' | 'round_robin' | 'least_busy'; version 0 for a team without one yet.
  setAssignmentPolicy: (orgId, unitId, version, policy) =>
    api.put(`${DELIVERY}/assignment-policies/${unitId}`, { policy }, { headers: ifMatch(orgId, version) }),
}

// ---------- Routing: which team does which kind of work ----------
export const routingApi = {
  // Every rule, turned-off ones included: [{ id, task_type_code | discipline, vertical, unit, accepts_requests, active, version }].
  rules: (orgId, { signal } = {}) => listAll(`${DELIVERY}/routing-rules`, orgId, { include_inactive: 'true' }, { signal }),
  // { task_type_code | discipline, vertical_id?, unit_id, accepts_requests? }
  createRule: (orgId, body) => api.post(`${DELIVERY}/routing-rules`, body, { headers: inOrg(orgId) }),
  // { unit_id?, accepts_requests?, active? }
  updateRule: (orgId, rule, body) => api.patch(`${DELIVERY}/routing-rules/${rule.id}`, body, { headers: ifMatch(orgId, rule.version) }),
  // Where this kind of work goes by the rules: { unit, rule_id, accepts_requests } (unit null when no rule covers it).
  route: (orgId, taskTypeCode, verticalId, { signal } = {}) =>
    api.get(`${DELIVERY}/task-routing?${pageQuery({ task_type_code: taskTypeCode, vertical_id: verticalId })}`, { headers: inOrg(orgId), signal }),
}

// ---------- Requests: asking another team for work (delivery.task.request) ----------
export const requestsApi = {
  // What teams take requests for: { data: [{ task_type_code, name, discipline, vertical, unit }] }.
  types: (orgId, { signal } = {}) => api.get(`${DELIVERY}/requestable-types`, { headers: inOrg(orgId), signal }),
  // { task_type_code, title, description?, vertical_id?, subject?, priority?, due_at?, attributes? } -> the task.
  create: (orgId, body) => api.post(`${DELIVERY}/requests`, body, { headers: inOrg(orgId) }),
  // The requests I sent, newest first (a page of tasks). Filter: status (one or many).
  mine: (orgId, opts, { signal } = {}) => api.get(`${DELIVERY}/requests?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
}

// ---------- Lookups: delivery stores only ids for people, units, customers and verticals ----------
export const lookupsApi = {
  units: (orgId, { signal } = {}) => listAll(`${IDENTITY}/org-units`, orgId, {}, { signal }),
  // Who a task of the team may be given to: { data: [{ id, name, in_unit }], team_only }.
  // Needs delivery.task.write or delivery.handover.write (not identity.user.read).
  assignablePeople: (orgId, unitId, { signal } = {}) =>
    api.get(`${DELIVERY}/assignable-people?unit_id=${encodeURIComponent(unitId)}`, { headers: inOrg(orgId), signal }),
  verticals: (orgId, { signal } = {}) => listAll(`${IDENTITY}/verticals`, orgId, { status: 'active' }, { signal }),
  customers: (orgId, { signal } = {}) => customersApi.listAll(orgId, { signal }),
  // Leads to attach a task to (a sales touch is about a lead): one page, newest first.
  leads: (orgId, opts, { signal } = {}) => api.get(`${REVENUE}/leads?${pageQuery(opts)}`, { headers: inOrg(orgId), signal }),
  // The company's published custom fields for tasks (installed by vertical packs), for a team or vertical when given:
  taskCustomFields: (orgId, unitId, verticalId, { signal } = {}) =>
    listAll(
      `${IDENTITY}/field-definitions`,
      orgId,
      {
        object_type: 'task.task',
        status: 'published',
        scoped: true,
        ...(unitId ? { org_unit_id: unitId } : {}),
        ...(verticalId ? { vertical_id: verticalId } : {}),
      },
      { signal }
    ),
}
