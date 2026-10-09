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
  viewRolePresets: { permissions: ['identity.role_assignment.read'] },
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
  // Customers (revenue). Their outside services, providers and categories have their own pair.
  customers: { permissions: ['revenue.client.read'] },
  manageCustomers: { permissions: ['revenue.client.write'] },
  clientServices: { permissions: ['revenue.client_service.read'] },
  manageClientServices: { permissions: ['revenue.client_service.write'] },
  // Sales: lead → opportunity → quotation → contract. Converting into a new customer also
  // needs manageCustomers; quotations follow their opportunity's access.
  leads: { permissions: ['revenue.lead.read'] },
  manageLeads: { permissions: ['revenue.lead.write'] },
  opportunities: { permissions: ['revenue.opportunity.read'] },
  manageOpportunities: { permissions: ['revenue.opportunity.write'] },
  approveQuotations: { permissions: ['revenue.quotation.approve'] },
  contracts: { permissions: ['revenue.contract.read'] },
  manageContracts: { permissions: ['revenue.contract.write'] },
  offerings: { permissions: ['revenue.offering.read'] },
  manageOfferings: { permissions: ['revenue.offering.write'] },
  activities: { permissions: ['revenue.activity.read'] },
  logActivities: { permissions: ['revenue.activity.write'] },
  // Billing: invoices → payments → collections for overdue money.
  invoices: { permissions: ['revenue.invoice.read'] },
  manageInvoices: { permissions: ['revenue.invoice.write'] },
  payments: { permissions: ['revenue.payment.read'] },
  recordPayments: { permissions: ['revenue.payment.write'] },
  collections: { permissions: ['revenue.collection.read'] },
  manageCollections: { permissions: ['revenue.collection.write'] },
  // Stop expecting part of an invoice (accounting only: the GST already due is unchanged).
  writeOffInvoices: { permissions: ['revenue.invoice.write_off'] },
  // Contract billing schedules: what is ready to bill, milestones reached, billing a line.
  billingSchedules: { permissions: ['revenue.billing_schedule.read'] },
  billScheduleLines: { permissions: ['revenue.billing_schedule.write'] },
  // Tax setup: registrations, rates and rules, packs, numbering, billing settings.
  taxSetup: { permissions: ['revenue.tax.read'] },
  manageTax: { permissions: ['revenue.tax.manage'] },
  // TDS customers withheld, until it shows in 26AS and is claimed.
  tdsReceivables: { permissions: ['revenue.tds_receivable.read'] },
  manageTdsReceivables: { permissions: ['revenue.tds_receivable.write'] },
  // Tax reports: GST owed vs cash collected (tax setup), TDS withheld (TDS receivables).
  taxReports: { anyPermissions: ['revenue.tax.read', 'revenue.tds_receivable.read'] },
  // Documents attached to records. Seeing / attaching to a record also needs that record's
  // own access (e.g. contracts / manageContracts); the documents service checks both.
  documents: { permissions: ['document.read'] },
  uploadDocuments: { permissions: ['document.upload'] },
  documentCategories: { permissions: ['document.read', 'document.category.manage'] },
  // Delivery: projects (milestones, team, risks, change requests), tasks, time, handovers and
  // workflows. Working your own task (start, submit, tick its checklist, log your time) needs
  // only `tasks`; the backend checks you are the assignee.
  projects: { permissions: ['delivery.work_unit.read'] },
  manageProjects: { permissions: ['delivery.work_unit.write'] },
  decideChangeRequests: { permissions: ['delivery.change_request.approve'] },
  tasks: { permissions: ['delivery.task.read'] },
  manageTasks: { permissions: ['delivery.task.write'] },
  // Ask another team for work it takes requests for, and follow your requests.
  requestWork: { permissions: ['delivery.task.request'] },
  reviewTasks: { permissions: ['delivery.task.review'] },
  everyonesTime: { permissions: ['delivery.time_entry.read'] },
  handovers: { permissions: ['delivery.handover.read'] },
  manageHandovers: { permissions: ['delivery.handover.write'] },
  deliverySetup: { permissions: ['delivery.template.manage'] },
  workflows: { permissions: ['delivery.workflow.read'] },
  designWorkflows: { permissions: ['delivery.workflow.manage'] },
  operateWorkflows: { permissions: ['delivery.workflow.operate'] },
  approveWorkflowSteps: { permissions: ['delivery.workflow.approve'] },
  // Other people's sign-ins: where they're signed in, and the security log (IPs, failures).
  viewUserSessions: { permissions: ['identity.session.read'] },
  revokeUserSessions: { permissions: ['identity.session.revoke'] },
  auditLog: { permissions: ['identity.audit_log.read'] },
}
