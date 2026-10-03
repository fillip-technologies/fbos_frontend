// Helpers for presenting the permission catalog (`<service>.<entity>.<action>`) and
// computing what a user effectively ends up with from presets + direct grants.

const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const SERVICE_LABELS = {
  identity: 'Identity & access',
  revenue: 'Revenue',
  documents: 'Documents',
}

export const ENTITY_LABELS = {
  user: 'Users',
  user_permission: 'User permissions',
  role: 'Roles',
  role_assignment: 'Role presets on users',
  org_unit: 'Organization units',
  calendar: 'Calendars',
  field_definition: 'Custom fields',
  vertical_pack: 'Vertical packs',
  deal: 'Deals',
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
  const where = unitId ? `${unitsById[unitId]?.name || 'Unknown unit'} and below` : 'Whole organization'
  return selfOnly ? `${where} · own records only` : where
}

// Same merge rule as the backend: one grant per (code, unit); self-only only if every
// source is self-only. Returns [{ code, scope_unit_id, self_only, sources: [label] }].
export function effectiveAccess({ presets, permissions }, rolesById) {
  const merged = new Map()
  const add = (code, scopeUnitId, selfOnly, source) => {
    const key = `${code}|${scopeUnitId || ''}`
    const existing = merged.get(key)
    if (existing) {
      existing.self_only = existing.self_only && selfOnly
      if (!existing.sources.includes(source)) existing.sources.push(source)
    } else {
      merged.set(key, { code, scope_unit_id: scopeUnitId || null, self_only: selfOnly, sources: [source] })
    }
  }
  for (const preset of presets) {
    const role = rolesById[preset.role_id]
    if (!role) continue
    for (const code of role.permissions) add(code, preset.scope_unit_id, preset.self_only, role.name)
  }
  for (const perm of permissions) {
    add(perm.code, perm.scope_unit_id, perm.self_only, perm.source_role ? `${perm.source_role} role` : 'Direct')
  }
  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))
}

// Request body pieces for POST /users and PUT /users/{id}/permissions.
export function toRequestAccess({ presets, permissions }) {
  return {
    role_assignments: presets
      .filter((p) => p.role_id)
      .map((p) => ({ role_id: p.role_id, scope_unit_id: p.scope_unit_id || null, self_only: p.self_only })),
    permissions: permissions.map((p) => ({
      code: p.code,
      scope_unit_id: p.scope_unit_id || null,
      self_only: p.self_only,
    })),
  }
}
