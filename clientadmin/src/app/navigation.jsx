import { ACCESS } from '@/features/auth/access.js'

const icon = (d) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

// Sidebar entries, in display order. An item is shown only if hasAccess(user, item.access).
export const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    access: ACCESS.dashboard,
    icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  },
  {
    to: '/organizations',
    label: 'Companies',
    access: ACCESS.organizations,
    icon: icon(<><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 9h5a1 1 0 0 1 1 1v11" /><path d="M8 8h2M8 12h2M8 16h2" /></>),
  },
  {
    to: '/org-units',
    label: 'Company structure',
    access: ACCESS.orgUnits,
    icon: icon(<><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" /></>),
  },
  {
    to: '/calendars',
    label: 'Calendars',
    access: ACCESS.calendars,
    icon: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 14h2M14 14h2M8 17h2" /></>),
  },
  {
    to: '/custom-fields',
    label: 'Custom fields',
    access: ACCESS.customFields,
    icon: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h6M7 13h10M7 17h4" /><path d="M17 7v4M15 9h4" /></>),
  },
  {
    to: '/vertical-packs',
    label: 'Vertical packs',
    access: ACCESS.verticalPacks,
    icon: icon(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>),
  },
  {
    to: '/leads',
    label: 'Leads',
    access: ACCESS.leads,
    icon: icon(<><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" /></>),
  },
  {
    to: '/opportunities',
    label: 'Opportunities',
    access: ACCESS.opportunities,
    icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  },
  {
    to: '/customers',
    label: 'Customers',
    access: ACCESS.customers,
    icon: icon(<><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></>),
  },
  {
    to: '/contracts',
    label: 'Contracts',
    access: ACCESS.contracts,
    icon: icon(<><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h5" /></>),
  },
  {
    to: '/projects',
    label: 'Projects',
    access: ACCESS.projects,
    icon: icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 13h4M8 16h7" /></>),
  },
  {
    to: '/tasks',
    label: 'Tasks',
    access: ACCESS.tasks,
    icon: icon(<><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  },
  {
    to: '/invoices',
    label: 'Invoices',
    access: ACCESS.invoices,
    icon: icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  },
  {
    to: '/payments',
    label: 'Payments',
    access: ACCESS.payments,
    icon: icon(<><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>),
  },
  {
    to: '/collections',
    label: 'Collections',
    access: ACCESS.collections,
    icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  },
  {
    to: '/client-services',
    label: 'Client services',
    access: ACCESS.clientServices,
    icon: icon(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="M7 9h4M7 12h7" /></>),
  },
  {
    to: '/service-providers',
    label: 'Service providers',
    access: ACCESS.clientServices,
    icon: icon(<><path d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M3 13h18" /></>),
  },
  {
    to: '/offerings',
    label: 'Offerings',
    access: ACCESS.offerings,
    icon: icon(<><path d="M20 12l-8 8-9-9V3h8l9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>),
  },
  {
    to: '/document-categories',
    label: 'Document categories',
    access: ACCESS.documentCategories,
    icon: icon(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M8 13h8" /></>),
  },
  {
    to: '/users',
    label: 'Users',
    access: ACCESS.users,
    icon: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-3-5.5" /></>),
  },
  {
    to: '/roles',
    label: 'Roles',
    access: ACCESS.roles,
    icon: icon(<><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    to: '/audit-log',
    label: 'Security log',
    access: ACCESS.auditLog,
    icon: icon(<path d="M3 12h4l3-8 4 16 3-8h4" />),
  },
]
