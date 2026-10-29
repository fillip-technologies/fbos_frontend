import { ACCESS } from '@/features/auth/access.js'
import { inventoryPageOn } from '@/features/inventory/flags.js'

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
    to: '/assets',
    label: 'Assets',
    access: ACCESS.assets,
    icon: icon(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>),
  },
  {
    to: '/people/employees',
    label: 'Employees',
    access: ACCESS.people,
    icon: icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  },
  {
    to: '/people/jobs',
    label: 'Recruitment',
    access: ACCESS.recruitment,
    icon: icon(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M12 12v.01" /><path d="M2 13a20 20 0 0 0 20 0" /></>),
  },
  {
    to: '/people/attendance',
    label: 'Attendance',
    access: ACCESS.attendance,
    icon: icon(<><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></>),
  },
  {
    to: '/people/leaves',
    label: 'Leaves',
    access: ACCESS.leaves,
    icon: icon(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" /></>),
  },
  {
    to: '/people/payroll',
    label: 'Payroll & Expenses',
    access: ACCESS.compensation,
    icon: icon(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><path d="M6 15h2M12 15h6" /></>),
  },
  {
    to: '/people/offboarding',
    label: 'Offboarding',
    access: ACCESS.manageSeparation,
    icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="11" x2="23" y2="11" /></>),
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
    to: '/verticals',
    label: 'Verticals',
    access: ACCESS.verticals,
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
    to: '/requests',
    label: 'My requests',
    access: ACCESS.requestWork,
    icon: icon(<><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>),
  },
  {
    to: '/task-types',
    label: 'Task types',
    access: ACCESS.deliverySetup,
    icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 17.5h7M17.5 14v7" /></>),
  },
  {
    to: '/project-templates',
    label: 'Project templates',
    access: ACCESS.projectTemplates,
    icon: icon(<><rect x="4" y="3" width="16" height="18" rx="2" strokeDasharray="3 2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  },
  ...(inventoryPageOn('devices')
    ? [{
        to: '/inventory/devices',
        label: 'Devices',
        access: ACCESS.devices,
        icon: icon(<><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 10l5-3v10l-5-3" /><circle cx="9.5" cy="12" r="2" /></>),
      }]
    : []),
  ...(inventoryPageOn('stock')
    ? [{
        to: '/inventory/stock',
        label: 'Stock',
        access: ACCESS.devices,
        icon: icon(<><path d="M3 9l9-5 9 5v11H3V9z" /><path d="M8 20v-6h8v6" /><path d="M8 11h8" /></>),
      }]
    : []),
  ...(inventoryPageOn('transfers')
    ? [{
        to: '/inventory/transfers',
        label: 'Transfers',
        access: ACCESS.stockTransfers,
        icon: icon(<><path d="M3 7h13l-3-3M21 17H8l3 3" /></>),
      }]
    : []),
  ...(inventoryPageOn('service')
    ? [
        {
          to: '/inventory/issues',
          label: 'Device issues',
          access: ACCESS.deviceIssues,
          icon: icon(<><path d="M12 3l9 16H3L12 3z" /><path d="M12 10v4M12 17h.01" /></>),
        },
        {
          to: '/inventory/repairs',
          label: 'Repairs',
          access: ACCESS.repairOrders,
          icon: icon(<><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z" /></>),
        },
        {
          to: '/inventory/disposals',
          label: 'Disposals',
          access: ACCESS.disposals,
          icon: icon(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>),
        },
      ]
    : []),
  ...(inventoryPageOn('reports')
    ? [{
        to: '/inventory/reports',
        label: 'Inventory reports',
        access: ACCESS.inventoryReports,
        icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
      }]
    : []),
  ...(inventoryPageOn('purchasing')
    ? [{
        to: '/inventory/purchase-orders',
        label: 'Purchasing',
        access: ACCESS.purchaseOrders,
        icon: icon(<><path d="M3 4h2l2.5 11h11L21 7H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>),
      }]
    : []),
  {
    to: '/invoices',
    label: 'Invoices',
    access: ACCESS.invoices,
    icon: icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  },
  {
    to: '/billing-schedules',
    label: 'Ready to bill',
    access: ACCESS.billingSchedules,
    icon: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M8 15l2 2 4-4" /></>),
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
    to: '/tax-reports',
    label: 'Tax reports',
    access: ACCESS.taxReports,
    icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
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
    to: '/tax-setup',
    label: 'Tax setup',
    access: ACCESS.taxSetup,
    icon: icon(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>),
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
