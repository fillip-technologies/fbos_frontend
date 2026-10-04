// Central access-control rules for the console. Any organization user can sign in;
// what they see depends on who they are.
//
// Access is user-based: /auth/me returns the signed-in user's effective permission codes
// (`user.permissions`) and the role presets applied to them (`user.roles[].role_code`).
// A rule combines these conditions — every condition present must hold:
//
//   { userTypes: ['client_admin'] }            user type is one of these
//   { permissions: ['identity.user.read'] }    holds ALL of these permissions
//   { anyPermissions: ['a.b.c', 'x.y.z'] }     holds AT LEAST ONE of these permissions
//   { roles: ['team_lead', 'hr'] }             has AT LEAST ONE of these role presets applied
//
// No rule (null) means "any signed-in user". Rules are used by the sidebar (to hide items),
// the route guard (to block typed URLs) and buttons (to hide actions), so they can't drift.
//
// Client administrators are the tenant superuser: the backend lets them through every
// permission check, so they pass every rule here except a `userTypes` rule that excludes them.
// This is UX only: the backend remains the authority and rejects forbidden calls.

export const isClientAdmin = (user) => user?.user_type === 'client_admin'

// Does the user hold `permission` (in any scope)?
export function can(user, permission) {
  if (!user) return false
  if (isClientAdmin(user)) return true
  return (user.permissions || []).includes(permission)
}

// Has the role preset with this code been applied to the user?
export function hasRole(user, roleCode) {
  return (user?.roles || []).some((r) => r.role_code === roleCode)
}

export function hasAccess(user, rule) {
  if (!user) return false
  if (!rule) return true
  if (rule.userTypes && !rule.userTypes.includes(user.user_type)) return false
  if (isClientAdmin(user)) return true
  if (rule.permissions && !rule.permissions.every((p) => can(user, p))) return false
  if (rule.anyPermissions && !rule.anyPermissions.some((p) => can(user, p))) return false
  if (rule.roles && !rule.roles.some((code) => hasRole(user, code))) return false
  return true
}

// One entry per page or action; reference these from navigation.jsx, App.jsx and pages.
export const ACCESS = {
  dashboard: null,
  profile: null,
  // Organizations and the client subscription are client-admin only on the backend too.
  organizations: { userTypes: ['client_admin'] },
  subscription: { userTypes: ['client_admin'] },
  users: { permissions: ['identity.user.read'] },
  inviteUsers: { permissions: ['identity.user.create'] },
  updateUsers: { permissions: ['identity.user.update'] },
  deactivateUsers: { permissions: ['identity.user.deactivate'] },
  viewUserAccess: { permissions: ['identity.user_permission.read'] },
  // Editing access needs the permission catalog too, which is part of role read access.
  manageUserAccess: { permissions: ['identity.user_permission.manage', 'identity.role.read'] },
  roles: { permissions: ['identity.role.read'] },
  createRoles: { permissions: ['identity.role.create'] },
  updateRoles: { permissions: ['identity.role.update'] },
  orgUnits: { permissions: ['identity.org_unit.read'] },
  createOrgUnit: { permissions: ['identity.org_unit.create'] },
  updateOrgUnit: { permissions: ['identity.org_unit.update'] },
  moveOrgUnit: { permissions: ['identity.org_unit.move'] },
  calendars: { permissions: ['identity.calendar.read'] },
  createCalendar: { permissions: ['identity.calendar.create'] },
  updateCalendar: { permissions: ['identity.calendar.update'] },
  customFields: { permissions: ['identity.field_definition.read'] },
  createCustomFields: { permissions: ['identity.field_definition.create'] },
  publishCustomFields: { permissions: ['identity.field_definition.publish'] },
  manageVerticals: { permissions: ['identity.vertical.manage'] },
  // Packs are designed once for the whole client and installed per company.
  verticalPacks: { anyPermissions: ['identity.vertical_pack.manage', 'identity.vertical_pack.install'] },
  designPacks: { permissions: ['identity.vertical_pack.manage'] },
  installPacks: { permissions: ['identity.vertical_pack.install'] },
}
