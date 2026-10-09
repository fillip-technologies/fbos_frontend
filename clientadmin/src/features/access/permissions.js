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

// ---- Role presets in the editor ----
// A preset is { key, role_id, scope_unit_id, self_only }. While a preset is applied the user
// holds every permission of its role in its scope (the server expands presets the same way),
// so each permission it added is tagged with its `preset_key`.

const sameScope = (a, b) => (a.scope_unit_id || null) === (b.scope_unit_id || null)
const grants = (rolesById, preset, code) => Boolean(rolesById[preset.role_id]?.permissions.includes(code))

// Whether `perm` gives what `preset` needs for `perm.code`: same scope, at least as broad.
const satisfies = (perm, preset) => sameScope(perm, preset) && (preset.self_only || !perm.self_only)

export const samePresetScope = (a, b) => a.role_id === b.role_id && sameScope(a, b)

// Adds `preset` and every permission of its role the user doesn't already hold there.
// A permission already held more narrowly is widened, as the server would.
export function applyPreset(value, preset, rolesById, newKey) {
  const role = rolesById[preset.role_id]
  if (!role) return value
  const permissions = value.permissions.map((p) =>
    grants(rolesById, preset, p.code) && sameScope(p, preset) && p.self_only && !preset.self_only ? { ...p, self_only: false } : p
  )
  const added = role.permissions
    .filter((code) => !permissions.some((p) => p.code === code && sameScope(p, preset)))
    .map((code) => ({
      key: newKey(),
      code,
      scope_unit_id: preset.scope_unit_id || null,
      self_only: preset.self_only,
      source_role: role.code,
      preset_key: preset.key,
    }))
  return { presets: [...value.presets, preset], permissions: [...permissions, ...added] }
}

// Takes a preset off. What it added goes too, except permissions another remaining preset
// also grants in that scope: those stay, credited to that role, at its level.
export function removePresets(value, keys, rolesById) {
  const gone = new Set(keys)
  const rest = value.presets.filter((p) => !gone.has(p.key))
  const permissions = value.permissions.flatMap((perm) => {
    if (!gone.has(perm.preset_key)) return [perm]
    const other = rest.find((p) => sameScope(p, perm) && grants(rolesById, p, perm.code))
    if (!other) return []
    return [{ ...perm, self_only: other.self_only, preset_key: other.key, source_role: rolesById[other.role_id].code }]
  })
  return { presets: rest, permissions }
}

// Moves a preset to another scope or level: its permissions move with it.
export function updatePreset(value, key, patch, rolesById, newKey) {
  const preset = value.presets.find((p) => p.key === key)
  if (!preset) return value
  return applyPreset(removePresets(value, [key], rolesById), { ...preset, ...patch }, rolesById, newKey)
}

// Adds the permissions a preset's role gained after it was applied. Returns the new value
// and, per preset, the codes added, so the editor can say so before it's saved.
export function syncPresets(value, rolesById, newKey) {
  let next = { ...value, presets: [] }
  const changes = []
  for (const preset of value.presets) {
    const before = next.permissions.length
    next = applyPreset(next, preset, rolesById, newKey)
    const codes = next.permissions.slice(before).map((p) => p.code)
    if (codes.length) changes.push({ preset, codes })
  }
  // A preset whose role is unknown here is kept untouched.
  next.presets = value.presets
  return { value: next, changes }
}

// After a permission is edited on its own: a preset that is no longer fully held is taken
// off (its permissions stay as they are), otherwise saving would put the permission back.
// Returns the new value and the presets taken off.
export function pruneUnheldPresets(value, rolesById) {
  const dropped = value.presets.filter((preset) => {
    const role = rolesById[preset.role_id]
    return role && !role.permissions.every((code) => value.permissions.some((p) => p.code === code && satisfies(p, preset)))
  })
  if (!dropped.length) return { value, dropped }
  const gone = new Set(dropped.map((p) => p.key))
  return {
    value: {
      presets: value.presets.filter((p) => !gone.has(p.key)),
      permissions: value.permissions.map((p) => (gone.has(p.preset_key) ? { ...p, preset_key: undefined } : p)),
    },
    dropped,
  }
}

// Request body pieces for POST /users and PUT /users/{id}/permissions. Every permission
// names the role it came from. `role_assignments` is the user's complete set of presets;
// with `includePresets: false` it is left out, so the server keeps the presets it has.
export function toRequestAccess({ presets, permissions }, { includePresets = true } = {}) {
  return {
    ...(includePresets
      ? {
          role_assignments: presets.map((p) => ({
            role_id: p.role_id,
            scope_unit_id: p.scope_unit_id || null,
            self_only: p.self_only,
          })),
        }
      : {}),
    permissions: permissions.map((p) => ({
      code: p.code,
      scope_unit_id: p.scope_unit_id || null,
      self_only: p.self_only,
      ...(p.source_role ? { source_role_code: p.source_role } : {}),
    })),
  }
}
