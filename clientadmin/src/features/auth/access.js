// Central access-control rules for the client-admin console.
//
// A rule is { userTypes?: string[], permissions?: string[] } — every listed condition must
// hold. No rule means "any signed-in user". Rules are used by BOTH the sidebar (to hide
// items) and the route guard (to block direct URL visits), so they cannot drift apart.
//
// Client administrators are the tenant superuser: the backend's `require_client_admin`
// already lets them through, so they bypass permission checks here too. Other user types
// are checked against the permission codes returned by /auth/me (`user.permissions`).
// This is UX only: the backend remains the real authority and rejects forbidden calls.

export function hasAccess(user, rule) {
  if (!user) return false
  if (!rule) return true
  if (user.user_type === 'client_admin') return true
  if (rule.userTypes && !rule.userTypes.includes(user.user_type)) return false
  if (rule.permissions) {
    const granted = new Set(user.permissions || [])
    if (!rule.permissions.every((p) => granted.has(p))) return false
  }
  return true
}

// One entry per page; reference these from navigation.js and App.jsx.
export const ACCESS = {
  dashboard: null,
  organizations: { userTypes: ['client_admin'] },
  users: { permissions: ['identity.user.read'] },
  inviteUsers: { permissions: ['identity.user.create'] },
  roles: { permissions: ['identity.role.read'] },
  orgUnits: { permissions: ['identity.org_unit.read'] },
  createOrgUnit: { permissions: ['identity.org_unit.create'] },
  updateOrgUnit: { permissions: ['identity.org_unit.update'] },
  moveOrgUnit: { permissions: ['identity.org_unit.move'] },
  calendars: { permissions: ['identity.calendar.read'] },
  createCalendar: { permissions: ['identity.calendar.create'] },
  updateCalendar: { permissions: ['identity.calendar.update'] },
}
