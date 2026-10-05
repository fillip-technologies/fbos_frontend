// One import function per page. App.jsx turns each into a lazy route, and the sidebar
// calls the same function on hover, so a page's chunk is downloaded once and usually
// before the click lands.
export const pages = {
  Dashboard: () => import('@/features/dashboard/pages/Dashboard.jsx'),
  Organizations: () => import('@/features/organizations/pages/Organizations.jsx'),
  OrganizationCreate: () => import('@/features/organizations/pages/OrganizationCreate.jsx'),
  OrganizationDetail: () => import('@/features/organizations/pages/OrganizationDetail.jsx'),
  Users: () => import('@/features/users/pages/Users.jsx'),
  UserInvite: () => import('@/features/users/pages/UserInvite.jsx'),
  UserDetail: () => import('@/features/users/pages/UserDetail.jsx'),
  Roles: () => import('@/features/access/pages/Roles.jsx'),
  OrgUnits: () => import('@/features/org-units/pages/OrgUnits.jsx'),
  OrgUnitCreate: () => import('@/features/org-units/pages/OrgUnitCreate.jsx'),
  OrgUnitDetail: () => import('@/features/org-units/pages/OrgUnitDetail.jsx'),
  Calendars: () => import('@/features/calendars/pages/Calendars.jsx'),
  CustomFields: () => import('@/features/verticals/pages/CustomFields.jsx'),
  VerticalPacks: () => import('@/features/verticals/pages/VerticalPacks.jsx'),
  PackDesigner: () => import('@/features/verticals/pages/PackDesigner.jsx'),
  AuditLog: () => import('@/features/audit-log/pages/AuditLog.jsx'),
  Profile: () => import('@/features/profile/pages/Profile.jsx'),
  Customers: () => import('@/features/customers/pages/Customers.jsx'),
  CustomerCreate: () => import('@/features/customers/pages/CustomerCreate.jsx'),
  CustomerDetail: () => import('@/features/customers/pages/CustomerDetail.jsx'),
  ClientServices: () => import('@/features/customers/pages/ClientServices.jsx'),
  ServiceProviders: () => import('@/features/customers/pages/ServiceProviders.jsx'),
  Leads: () => import('@/features/sales/pages/Leads.jsx'),
  LeadCreate: () => import('@/features/sales/pages/LeadCreate.jsx'),
  LeadDetail: () => import('@/features/sales/pages/LeadDetail.jsx'),
  Opportunities: () => import('@/features/sales/pages/Opportunities.jsx'),
  OpportunityDetail: () => import('@/features/sales/pages/OpportunityDetail.jsx'),
  QuotationDetail: () => import('@/features/sales/pages/QuotationDetail.jsx'),
  Contracts: () => import('@/features/sales/pages/Contracts.jsx'),
  ContractDetail: () => import('@/features/sales/pages/ContractDetail.jsx'),
  Offerings: () => import('@/features/sales/pages/Offerings.jsx'),
  Invoices: () => import('@/features/billing/pages/Invoices.jsx'),
  InvoiceCreate: () => import('@/features/billing/pages/InvoiceCreate.jsx'),
  InvoiceDetail: () => import('@/features/billing/pages/InvoiceDetail.jsx'),
  Payments: () => import('@/features/billing/pages/Payments.jsx'),
  PaymentCreate: () => import('@/features/billing/pages/PaymentCreate.jsx'),
  PaymentDetail: () => import('@/features/billing/pages/PaymentDetail.jsx'),
  Collections: () => import('@/features/billing/pages/Collections.jsx'),
}

// Sidebar path -> the pages of that section. Hovering an entry downloads the list page
// and the pages reached from it (detail, create), so neither click waits for code.
const NAV_PAGES = {
  '/': [pages.Dashboard],
  '/organizations': [pages.Organizations, pages.OrganizationDetail, pages.OrganizationCreate],
  '/org-units': [pages.OrgUnits, pages.OrgUnitDetail, pages.OrgUnitCreate],
  '/calendars': [pages.Calendars],
  '/custom-fields': [pages.CustomFields],
  '/vertical-packs': [pages.VerticalPacks, pages.PackDesigner],
  '/leads': [pages.Leads, pages.LeadDetail, pages.LeadCreate],
  '/opportunities': [pages.Opportunities, pages.OpportunityDetail, pages.QuotationDetail],
  '/customers': [pages.Customers, pages.CustomerDetail, pages.CustomerCreate],
  '/contracts': [pages.Contracts, pages.ContractDetail],
  '/invoices': [pages.Invoices, pages.InvoiceDetail, pages.InvoiceCreate],
  '/payments': [pages.Payments, pages.PaymentDetail, pages.PaymentCreate],
  '/collections': [pages.Collections],
  '/client-services': [pages.ClientServices],
  '/service-providers': [pages.ServiceProviders],
  '/offerings': [pages.Offerings],
  '/users': [pages.Users, pages.UserDetail, pages.UserInvite],
  '/roles': [pages.Roles],
  '/audit-log': [pages.AuditLog],
  '/profile': [pages.Profile],
}

// Starts downloading a section's code; a failed preload is ignored (the click retries it).
export function preloadPage(path) {
  for (const load of NAV_PAGES[path] ?? []) load().catch(() => {})
}
