// Org-unit structure rules, mirroring the identity backend (org_unit_service.ALLOWED_PARENTS).
// The organization itself is the company, so the structure starts at branches.
// The backend still enforces them; these only keep the forms from offering invalid choices.

export const UNIT_TYPES = [
  { value: 'branch', label: 'Branch', help: 'An office or location. Sits directly under the company.' },
  { value: 'department', label: 'Department', help: 'A function such as Sales or Finance. Sits under a branch or another department.' },
  { value: 'team', label: 'Team', help: 'A working group. Sits under a department.' },
]

export const UNIT_TYPE_LABELS = Object.fromEntries(UNIT_TYPES.map((t) => [t.value, t.label]))

export const ALLOWED_PARENTS = {
  branch: [],
  department: ['branch', 'department'],
  team: ['department'],
}

// Types that sit directly under the organization, with no parent unit.
export const isTopLevelType = (unitType) => unitType === 'branch'

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

// Branches and departments may set their own verticals; teams follow their department.
export const canSetVerticals = (unitType) => unitType === 'branch' || unitType === 'department'

// The verticals that apply to a unit: its own, else the nearest ancestor's (as the backend
// resolves them). Returns { ids, from } where `from` is the ancestor they come from, if any.
export function effectiveVerticals(unit, unitsById) {
  const chain = unit.path.split('/').filter(Boolean).reverse()
  for (const id of chain) {
    const u = id === unit.id ? unit : unitsById[id]
    if (u?.vertical_ids?.length) return { ids: u.vertical_ids, from: u.id === unit.id ? null : u }
  }
  return { ids: [], from: null }
}
