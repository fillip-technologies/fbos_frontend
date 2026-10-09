// Helpers for presenting the permission catalog (`<service>.<entity>.<action>`) and
// computing what a user effectively ends up with from presets + direct grants.

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const SERVICE_LABELS = {
  identity: 'Identity & access',
  revenue: 'Revenue',
  delivery: 'Projects & tasks',
  control: 'Approvals & SLAs',
  documents: 'Documents',
}

export const ENTITY_LABELS = {
  user: 'Users',
  user_permission: 'User permissions',
  role: 'Roles',
  role_assignment: 'Role presets on users',
  org_unit: 'Company structure',
  calendar: 'Calendars',
  field_definition: 'Custom fields',
  vertical_pack: 'Vertical packs',
  session: 'Sign-in sessions',
  audit_log: 'Security audit log',
  // Revenue, named as in the sidebar.
  client: 'Customers',
  client_service: 'Client services',
  lead: 'Leads',
  opportunity: 'Opportunities',
  quotation: 'Quotations',
  contract: 'Contracts',
  offering: 'Offerings',
  activity: 'Calls, meetings & notes',
  invoice: 'Invoices',
  payment: 'Payments',
  collection: 'Collections',
  tax: 'Tax setup',
  billing_schedule: 'Billing schedules',
  tds_receivable: 'TDS withheld by customers',
  deal: 'Deals',
  // Delivery: the backend's "work units" are projects.
  work_unit: 'Projects',
  change_request: 'Change requests',
  task: 'Tasks',
  time_entry: 'Logged time',
  handover: 'Handovers',
  template: 'Project & task setup',
  workflow: 'Workflows',
  // Control.
  approval: 'Approvals',
  sla: 'SLAs',
  // Documents.
  document: 'Documents',
  category: 'Document categories',
}

export function parseCode(code) {
  const [service, entity, action] = code.split('.')
  return { service, entity: action ? entity : service, action: action ?? entity }
}

export const actionLabel = (code) => titleCase(parseCode(code).action)
export const entityLabel = (entity) => ENTITY_LABELS[entity] || titleCase(entity)
export const serviceLabel = (service) => SERVICE_LABELS[service] || titleCase(service)

// [{ service, entities: [{ entity, permissions: [catalogItem] }] }] in catalog order.
export function groupCatalog(catalog) {
  const services = new Map()
  for (const perm of catalog) {
    const { entity } = parseCode(perm.code)
    if (!services.has(perm.service)) services.set(perm.service, new Map())
    const entities = services.get(perm.service)
    if (!entities.has(entity)) entities.set(entity, [])
    entities.get(entity).push(perm)
  }
  return [...services].map(([service, entities]) => ({
    service,
    entities: [...entities].map(([entity, permissions]) => ({ entity, permissions })),
  }))
}

// Units sorted as a tree (by materialized path) with their depth for indentation.
export function unitTree(units) {
  return [...units]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((u) => ({ ...u, depth: Math.max(0, u.path.split('/').filter(Boolean).length - 1) }))
}

export function scopeLabel(unitId, unitsById, selfOnly) {
  const where = unitId ? `${unitsById[unitId]?.name || 'Unknown place'} and below` : 'Whole company'
  return selfOnly ? `${where} · own records only` : where
}

// Same merge rule as the backend: one grant per (code, unit); self-only only if every
// source is self-only. Applied roles are already expanded into `permissions`.
// Returns [{ code, scope_unit_id, self_only, sources: [label] }].
export function effectiveAccess({ permissions }) {
  const merged = new Map()
  for (const perm of permissions) {
    const key = `${perm.code}|${perm.scope_unit_id || ''}`
    const source = perm.source_role ? `${perm.source_role} role` : 'Direct'
    const existing = merged.get(key)
    if (existing) {
      existing.self_only = existing.self_only && perm.self_only
      if (!existing.sources.includes(source)) existing.sources.push(source)
    } else {
      merged.set(key, { code: perm.code, scope_unit_id: perm.scope_unit_id || null, self_only: perm.self_only, sources: [source] })
    }
  }
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))
}

const sameLevel = (perm, level) => (perm.scope_unit_id || null) === level.scope_unit_id && perm.self_only === level.self_only

// The one level at which every permission of a role applied in the editor is still held,
// or undefined once its permissions were moved to different levels or removed.
function uniformLevel(preset, role, permissions) {
  const levels = permissions
    .filter((p) => p.preset_key === preset.key)
    .map((p) => ({ scope_unit_id: p.scope_unit_id || null, self_only: p.self_only }))
  return levels.find((level) => role.permissions.every((code) => permissions.some((p) => p.code === code && sameLevel(p, level))))
}

// Request body pieces for POST /users and PUT /users/{id}/permissions. Every permission
// names the role it came from; a role applied here is also recorded as a preset (shown on
// the user, and used to find users by role) while it still applies at one level.
export function toRequestAccess({ presets, permissions }, roles) {
  const rolesById = Object.fromEntries(roles.map((r) => [r.id, r]))
  const roleAssignments = []
  for (const preset of presets) {
    const role = rolesById[preset.role_id]
    const level = role && uniformLevel(preset, role, permissions)
    if (level) roleAssignments.push({ role_id: role.id, ...level })
  }
  return {
    role_assignments: roleAssignments,
    permissions: permissions.map((p) => ({
      code: p.code,
      scope_unit_id: p.scope_unit_id || null,
      self_only: p.self_only,
      ...(p.source_role ? { source_role_code: p.source_role } : {}),
    })),
  }
}
