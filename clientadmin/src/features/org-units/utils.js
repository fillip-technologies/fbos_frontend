// Org-unit structure rules, mirroring the identity backend (org_unit_service.ALLOWED_PARENTS).
// The backend still enforces them; these only keep the forms from offering invalid choices.

export const UNIT_TYPES = [
  { value: 'company', label: 'Company', help: 'The top of the structure. Has no parent.' },
  { value: 'branch', label: 'Branch', help: 'An office or location. Sits under a company.' },
  { value: 'department', label: 'Department', help: 'A function such as Sales or Finance. Sits under a company, branch or department.' },
  { value: 'team', label: 'Team', help: 'A working group. Sits under a department.' },
]

export const UNIT_TYPE_LABELS = Object.fromEntries(UNIT_TYPES.map((t) => [t.value, t.label]))

export const ALLOWED_PARENTS = {
  company: [],
  branch: ['company'],
  department: ['company', 'branch', 'department'],
  team: ['department'],
}

// Unit types that can be created directly under a parent of `parentType`.
export function childTypesFor(parentType) {
  return UNIT_TYPES.filter((t) => ALLOWED_PARENTS[t.value].includes(parentType)).map((t) => t.value)
}

// Whether `unit` is `ancestor` itself or anywhere below it (paths look like "/a/b/c/").
export function isWithin(unit, ancestor) {
  return unit.path.startsWith(ancestor.path)
}

// Active units a unit of `unitType` may be placed under, excluding `self` and its subtree.
export function parentCandidates(units, unitType, self = null) {
  const allowed = ALLOWED_PARENTS[unitType] || []
  return units.filter(
    (u) => u.status === 'active' && allowed.includes(u.unit_type) && !(self && isWithin(u, self))
  )
}

// Units in tree order (each parent followed by its children, siblings by name), with a
// `depth` for indentation. A unit whose parent isn't in the list is shown as a root.
export function sortedTree(units) {
  const ids = new Set(units.map((u) => u.id))
  const children = new Map()
  for (const u of units) {
    const key = u.parent_id && ids.has(u.parent_id) ? u.parent_id : null
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(u)
  }
  const out = []
  const walk = (parentId, depth) => {
    const kids = (children.get(parentId) || []).sort((a, b) => a.name.localeCompare(b.name))
    for (const u of kids) {
      out.push({ ...u, depth })
      walk(u.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// Ancestors of a unit, top first, resolved from its path.
export function breadcrumb(unit, unitsById) {
  return unit.path
    .split('/')
    .filter(Boolean)
    .slice(0, -1)
    .map((id) => unitsById[id])
    .filter(Boolean)
}
