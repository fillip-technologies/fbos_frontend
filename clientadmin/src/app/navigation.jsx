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
    to: '/guide',
    label: 'How FBOS works',
    access: ACCESS.dashboard,
    icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17h.01" /></>),
  },
  {
    to: '/ceo',
    label: 'CEO Command Center',
    access: ACCESS.ceoDashboard,
    icon: icon(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="6" /><path d="M12 12l3-2" /></>),
  },
  {
    to: '/insights',
    label: 'Insights',
    access: ACCESS.insights,
    icon: icon(<><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /><circle cx="19" cy="6" r="1.5" /></>),
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
    to: '/scorecard',
    label: 'Scorecard',
    access: ACCESS.scorecard,
    icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  },
  {
    to: '/planning',
    label: 'Planning',
    access: ACCESS.planning,
    icon: icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  },
  {
    to: '/budgets',
    label: 'Budgets',
    access: ACCESS.budgets,
    icon: icon(<><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /></>),
  },
  {
    to: '/capacity',
    label: 'Capacity',
    access: ACCESS.capacity,
    icon: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 8v6M20 11h-6" /></>),
  },
  {
    to: '/people/jobs',
    label: 'Recruitment',
    access: ACCESS.recruitment,
    icon: icon(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M12 12v.01" /><path d="M2 13a20 20 0 0 0 20 0" /></>),
  },
  {
    to: '/people/interviews',
    label: 'My interviews',
    access: ACCESS.interviews,
    icon: icon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>),
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
    to: '/people/role-changes',
    label: 'Role changes',
    access: ACCESS.roleChanges,
    icon: icon(<><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></>),
  },
  {
    to: '/people/approvals',
    label: 'Approvals & access',
    access: ACCESS.roleChangeSetup,
    icon: icon(<><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    to: '/people/org-chart',
    label: 'Org chart',
    access: ACCESS.people,
    icon: icon(<><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></>),
  },
  {
    to: '/people/post-report',
    label: 'Posts & FTE',
    access: ACCESS.people,
    icon: icon(<><line x1="4" y1="20" x2="20" y2="20" /><rect x="5" y="11" width="3" height="9" /><rect x="10.5" y="6" width="3" height="14" /><rect x="16" y="14" width="3" height="6" /></>),
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
    label: 'Users and employees',
    access: ACCESS.usersOrPeople,
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

// What each page is for, in a sentence a new person understands. Shown in the sidebar's
// tooltip, the command palette, the home directory and the page's own intro.
const DESCRIPTIONS = {
  '/': 'Your starting point: what needs you today, and how the company is doing.',
  '/guide': 'How the parts of FBOS fit together, from first enquiry to money in the bank.',
  '/insights': 'Compare branches, departments, teams and people: work, hours, budgets and KPIs.',
  '/ceo': 'Every company on one screen: revenue, money owed, projects, people, costs and what needs a decision.',
  '/organizations': 'The companies in your account, and switching between them.',
  '/org-units': 'Branches, departments and teams, and who belongs to each.',
  '/assets': 'Company equipment and software: who has what, servicing and disposal.',
  '/scorecard': 'How each KPI is doing against its target this period.',
  '/planning': 'Financial years, quarters and the goals set for them.',
  '/budgets': 'What each unit may spend, and what it has spent so far.',
  '/capacity': 'Who is busy and who is free: hours available against hours booked.',
  '/people/jobs': 'Open positions, candidates and where each one is in hiring.',
  '/people/interviews': 'Interviews you are on the panel for, and their feedback.',
  '/people/attendance': 'Who is in today, late or away.',
  '/people/leaves': 'Apply for leave, and approve your team\'s requests.',
  '/people/payroll': 'Salaries, payslips and expense claims.',
  '/people/role-changes': 'Promotions, transfers and new posts waiting for approval.',
  '/people/approvals': 'Who approves role changes, and the access each job gives.',
  '/people/org-chart': 'Who reports to whom.',
  '/people/post-report': 'Posts and headcount (FTE) by department.',
  '/people/offboarding': 'People leaving the company: notice, handover and final settlement.',
  '/calendars': 'Working days, hours and holidays for the company and its teams.',
  '/custom-fields': 'Add your own fields to forms such as leads, projects and tasks.',
  '/verticals': 'Your business lines (e.g. IT services, solar), used to tailor forms and routing.',
  '/leads': 'New enquiries. Qualify them, then turn the good ones into opportunities.',
  '/opportunities': 'Sales you are working on: quotations, negotiation, won or lost.',
  '/customers': 'Everyone you sell to: contacts, contracts, invoices and services in one place.',
  '/contracts': 'Signed agreements. Activating one starts delivery and its billing schedule.',
  '/projects': 'Work you deliver for a customer or for the company: milestones, team, risks.',
  '/tasks': 'Your work and your team\'s: to do, in progress, in review, done.',
  '/requests': 'Work you asked other teams to do, and where it stands.',
  '/task-types': 'Kinds of task, how work is routed to teams, and delivery settings.',
  '/project-templates': 'Ready-made project plans: phases, milestones and workflows.',
  '/inventory/devices': 'Every device you track, where it is installed and its history.',
  '/inventory/stock': 'What is in each store or warehouse.',
  '/inventory/transfers': 'Moving stock between locations.',
  '/inventory/issues': 'Faults reported on devices, and who is fixing them.',
  '/inventory/repairs': 'Devices sent out for repair.',
  '/inventory/disposals': 'Devices being scrapped or sold off.',
  '/inventory/reports': 'Inventory numbers: stock, faults, repairs and costs.',
  '/inventory/purchase-orders': 'Buying devices: orders to vendors and goods received.',
  '/invoices': 'Bills sent to customers, credit notes, and what is still owed.',
  '/billing-schedules': 'Contract payments that are due now. Bill them with one click.',
  '/payments': 'Money received, and which invoices it pays.',
  '/collections': 'Customers who are late paying, and follow-ups with them.',
  '/tax-reports': 'GST charged against cash received, and TDS customers withheld.',
  '/client-services': 'Services running for customers, such as hosting or support plans.',
  '/service-providers': 'Vendors behind the services you resell.',
  '/offerings': 'What you sell, with prices and how each is delivered.',
  '/tax-setup': 'Tax registrations, rates, rules and invoice numbering.',
  '/document-categories': 'The kinds of document people can attach to records.',
  '/users': 'Everyone who can sign in, and the employees behind them.',
  '/roles': 'Bundles of permissions you give to people.',
  '/audit-log': 'Who signed in and changed access, for security checks.',
}

// Sidebar sections, by the job people come to do, in display order. Each page belongs to the
// first section listing its path; a page listed nowhere lands in Settings (the last), so a new
// NAV_ITEMS entry is never hidden. `hint` says what the section is for (guide, tooltips);
// Settings starts folded: setup is done now and then, daily work every day.
export const SECTIONS = [
  { id: 'home', label: 'Home', hint: 'Start here', paths: ['/', '/ceo', '/guide', '/insights'] },
  {
    id: 'work',
    label: 'My work',
    hint: 'What is on your plate',
    paths: ['/tasks', '/requests', '/people/interviews', '/people/leaves'],
  },
  {
    id: 'sales',
    label: 'Sell',
    hint: 'Win customers: from first enquiry to signed contract',
    paths: ['/leads', '/opportunities', '/contracts', '/customers'],
  },
  {
    id: 'delivery',
    label: 'Deliver',
    hint: 'Do the work customers paid for',
    paths: ['/projects', '/client-services'],
  },
  {
    id: 'billing',
    label: 'Bill & collect',
    hint: 'Invoice the work and get paid',
    paths: ['/billing-schedules', '/invoices', '/payments', '/collections', '/tax-reports'],
  },
  {
    id: 'people',
    label: 'People',
    hint: 'Hire, look after and pay your team',
    paths: ['/users', '/people/jobs', '/people/attendance', '/people/payroll', '/people/role-changes', '/people/offboarding', '/people/org-chart', '/people/post-report'],
  },
  {
    id: 'plan',
    label: 'Plan & measure',
    hint: 'Set goals and budgets, then see how you are doing',
    paths: ['/planning', '/budgets', '/capacity', '/scorecard'],
  },
  {
    id: 'assets',
    label: 'Assets & inventory',
    hint: 'Equipment and stock: buy, track, fix and retire',
    paths: ['/assets', '/inventory/purchase-orders', '/inventory/stock', '/inventory/devices', '/inventory/transfers', '/inventory/issues', '/inventory/repairs', '/inventory/disposals', '/inventory/reports'],
  },
  {
    id: 'settings',
    label: 'Settings',
    hint: 'Set the company up once; change it now and then',
    defaultCollapsed: true,
    paths: [
      '/organizations', '/org-units', '/calendars', '/roles', '/people/approvals', '/offerings', '/tax-setup',
      '/task-types', '/project-templates', '/service-providers', '/custom-fields', '/verticals', '/document-categories', '/audit-log',
    ],
  },
]

// The end-to-end flows pages belong to, step by step. A page's intro shows its flow, so a person
// sees what comes before and after the page they are on, and can go there in one click.
export const FLOWS = [
  {
    id: 'lead-to-cash',
    label: 'From enquiry to payment',
    steps: [
      { to: '/leads', label: 'Enquiry', hint: 'Someone shows interest' },
      { to: '/opportunities', label: 'Opportunity', hint: 'Quote and negotiate' },
      { to: '/contracts', label: 'Contract', hint: 'Signed and activated' },
      { to: '/projects', label: 'Delivery', hint: 'Do the work' },
      { to: '/billing-schedules', label: 'Bill', hint: 'Payment terms fall due' },
      { to: '/invoices', label: 'Invoice', hint: 'Sent to the customer' },
      { to: '/payments', label: 'Paid', hint: 'Money received' },
      { to: '/collections', label: 'Chase', hint: 'Only if they pay late' },
    ],
  },
  {
    id: 'hire-to-exit',
    label: 'A person\'s time with you',
    steps: [
      { to: '/people/jobs', label: 'Hire', hint: 'Post a job, interview' },
      { to: '/users', label: 'Onboard', hint: 'Employee record and sign-in' },
      { to: '/people/attendance', label: 'Attend', hint: 'Day to day' },
      { to: '/people/leaves', label: 'Leave', hint: 'Time off' },
      { to: '/people/payroll', label: 'Pay', hint: 'Salary and expenses' },
      { to: '/people/role-changes', label: 'Grow', hint: 'Promotions, transfers' },
      { to: '/people/offboarding', label: 'Exit', hint: 'Notice and settlement' },
    ],
  },
  {
    id: 'plan-to-review',
    label: 'Plan, then measure',
    steps: [
      { to: '/planning', label: 'Plan', hint: 'Years, quarters, goals' },
      { to: '/budgets', label: 'Budget', hint: 'What units may spend' },
      { to: '/capacity', label: 'Staff', hint: 'Who is free to do it' },
      { to: '/scorecard', label: 'Review', hint: 'KPIs against targets' },
    ],
  },
  {
    id: 'buy-to-retire',
    label: 'An item\'s life',
    steps: [
      { to: '/inventory/purchase-orders', label: 'Buy', hint: 'Order and receive' },
      { to: '/inventory/stock', label: 'Store', hint: 'In stock' },
      { to: '/inventory/devices', label: 'Install', hint: 'In use at a site' },
      { to: '/inventory/issues', label: 'Fault', hint: 'Something broke' },
      { to: '/inventory/repairs', label: 'Repair', hint: 'Sent to be fixed' },
      { to: '/inventory/disposals', label: 'Retire', hint: 'Scrap or sell' },
    ],
  },
]

// The flow a page is a step of (its first), or null.
export function flowFor(path) {
  return FLOWS.find((flow) => flow.steps.some((step) => step.to === path)) ?? null
}

// Every item carries its description, so each place that lists pages can say what they are for.
for (const item of NAV_ITEMS) item.description = DESCRIPTIONS[item.to] ?? null

// The items a user may open, grouped into sections (empty sections dropped).
export function navSections(items) {
  const groups = SECTIONS.map((s) => ({ ...s, items: [] }))
  for (const item of items) {
    const group = groups.find((g) => g.paths.includes(item.to)) ?? groups[groups.length - 1]
    group.items.push(item)
  }
  for (const g of groups) g.items.sort((a, b) => g.paths.indexOf(a.to) - g.paths.indexOf(b.to))
  return groups.filter((g) => g.items.length > 0)
}

// Pages with no sidebar entry of their own, and the entry they belong under (for the breadcrumb
// and the open section): a quotation is part of a deal, an employee of Users and employees.
const BELONGS_UNDER = {
  '/quotations': '/opportunities',
  '/people/employees': '/users',
  '/task-workflows': '/task-types',
  '/project-workflows': '/project-templates',
}

// The nav item a path belongs to: the longest `to` that is the path or a parent of it.
export function navItemFor(items, pathname) {
  let best = null
  for (const item of items) {
    const match = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
    if (match && (!best || item.to.length > best.to.length)) best = item
  }
  if (best && best.to !== '/') return best
  const parent = Object.keys(BELONGS_UNDER).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return (parent && items.find((item) => item.to === BELONGS_UNDER[parent])) || best
}

// Things a person can start from anywhere (the top bar's "New" menu and the command palette),
// shown only when they may do them. `hint` says what it is in plain words.
export const CREATE_ACTIONS = [
  { to: '/leads/new', label: 'Lead', hint: 'Someone interested in buying', access: ACCESS.manageLeads },
  { to: '/customers/new', label: 'Customer', hint: 'A company or person you sell to', access: ACCESS.manageCustomers },
  { to: '/opportunities/new', label: 'Opportunity', hint: 'A sale to quote for', access: ACCESS.manageOpportunities },
  { to: '/projects/new', label: 'Project', hint: 'Work to deliver, with milestones', access: ACCESS.manageProjects },
  { to: '/tasks/new', label: 'Task', hint: 'One piece of work for someone', access: ACCESS.manageTasks },
  { to: '/requests/new', label: 'Request to a team', hint: 'Ask another team to do something', access: ACCESS.requestWork },
  { to: '/invoices/new', label: 'Invoice', hint: 'Bill a customer for an extra charge', access: ACCESS.manageInvoices },
  { to: '/payments/new', label: 'Payment received', hint: 'Record money a customer paid', access: ACCESS.recordPayments },
  { to: '/users/new', label: 'User', hint: 'Invite someone to sign in', access: ACCESS.inviteUsers },
  { to: '/assets/new', label: 'Asset', hint: 'Equipment or software to track', access: ACCESS.manageAssets },
  ...(inventoryPageOn('purchasing')
    ? [{ to: '/inventory/purchase-orders/new', label: 'Purchase order', hint: 'Buy from a vendor', access: ACCESS.managePurchaseOrders }]
    : []),
  ...(inventoryPageOn('transfers')
    ? [{ to: '/inventory/transfers/new', label: 'Stock transfer', hint: 'Move stock between locations', access: ACCESS.manageStockTransfers }]
    : []),
]
