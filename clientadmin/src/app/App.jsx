import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import Layout, { LayoutSkeleton } from '@/app/layout/Layout.jsx'
import RequireAccess from '@/features/auth/components/RequireAccess.jsx'
import { ACCESS } from '@/features/auth/access.js'
import Login from '@/features/auth/pages/Login.jsx'
import ForgotPassword from '@/features/auth/pages/ForgotPassword.jsx'
import SetPassword from '@/features/auth/pages/SetPassword.jsx'
import { ActiveOrgProvider } from '@/features/organizations/ActiveOrg.jsx'
import { pages } from '@/app/pages.js'
import { PageSkeleton } from '@/shared/components/Skeleton.jsx'

const Dashboard = lazy(pages.Dashboard)
const Organizations = lazy(pages.Organizations)
const OrganizationCreate = lazy(pages.OrganizationCreate)
const OrganizationDetail = lazy(pages.OrganizationDetail)
const Users = lazy(pages.Users)
const UserInvite = lazy(pages.UserInvite)
const UserDetail = lazy(pages.UserDetail)
const Roles = lazy(pages.Roles)
const OrgUnits = lazy(pages.OrgUnits)
const OrgUnitCreate = lazy(pages.OrgUnitCreate)
const OrgUnitDetail = lazy(pages.OrgUnitDetail)
const Calendars = lazy(pages.Calendars)
const CustomFields = lazy(pages.CustomFields)
const VerticalPacks = lazy(pages.VerticalPacks)
const PackDesigner = lazy(pages.PackDesigner)
const AuditLog = lazy(pages.AuditLog)
const Profile = lazy(pages.Profile)
const Customers = lazy(pages.Customers)
const CustomerCreate = lazy(pages.CustomerCreate)
const CustomerDetail = lazy(pages.CustomerDetail)
const ClientServices = lazy(pages.ClientServices)
const ServiceProviders = lazy(pages.ServiceProviders)
const Leads = lazy(pages.Leads)
const LeadCreate = lazy(pages.LeadCreate)
const LeadDetail = lazy(pages.LeadDetail)
const Opportunities = lazy(pages.Opportunities)
const OpportunityDetail = lazy(pages.OpportunityDetail)
const QuotationDetail = lazy(pages.QuotationDetail)
const Contracts = lazy(pages.Contracts)
const ContractDetail = lazy(pages.ContractDetail)
const Offerings = lazy(pages.Offerings)
const Invoices = lazy(pages.Invoices)
const InvoiceCreate = lazy(pages.InvoiceCreate)
const InvoiceDetail = lazy(pages.InvoiceDetail)
const Payments = lazy(pages.Payments)
const PaymentCreate = lazy(pages.PaymentCreate)
const PaymentDetail = lazy(pages.PaymentDetail)
const Collections = lazy(pages.Collections)

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LayoutSkeleton />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export default function App() {
  // Pages load on demand. Layout has its own boundary so the sidebar stays put while a
  // page's code arrives; this one only covers a route rendered outside it.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Public: sign-in and the pages the invitation / reset emails link to */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/accept-invitation" element={<SetPassword mode="invite" />} />
        <Route path="/reset-password" element={<SetPassword mode="reset" />} />
        <Route
          element={
            <RequireAuth>
              <ActiveOrgProvider>
                <Layout />
              </ActiveOrgProvider>
            </RequireAuth>
          }
        >
          <Route path="/" element={<RequireAccess rule={ACCESS.dashboard}><Dashboard /></RequireAccess>} />
          <Route path="/organizations" element={<RequireAccess rule={ACCESS.organizations}><Organizations /></RequireAccess>} />
          <Route path="/organizations/new" element={<RequireAccess rule={ACCESS.organizations}><OrganizationCreate /></RequireAccess>} />
          <Route path="/organizations/:id" element={<RequireAccess rule={ACCESS.organizations}><OrganizationDetail /></RequireAccess>} />
          <Route path="/users" element={<RequireAccess rule={ACCESS.users}><Users /></RequireAccess>} />
          <Route path="/users/new" element={<RequireAccess rule={ACCESS.inviteUsers}><UserInvite /></RequireAccess>} />
          <Route path="/users/:id" element={<RequireAccess rule={ACCESS.users}><UserDetail /></RequireAccess>} />
          <Route path="/roles" element={<RequireAccess rule={ACCESS.roles}><Roles /></RequireAccess>} />
          <Route path="/org-units" element={<RequireAccess rule={ACCESS.orgUnits}><OrgUnits /></RequireAccess>} />
          <Route path="/org-units/new" element={<RequireAccess rule={ACCESS.createOrgUnit}><OrgUnitCreate /></RequireAccess>} />
          <Route path="/org-units/:id" element={<RequireAccess rule={ACCESS.orgUnits}><OrgUnitDetail /></RequireAccess>} />
          <Route path="/calendars" element={<RequireAccess rule={ACCESS.calendars}><Calendars /></RequireAccess>} />
          <Route path="/custom-fields" element={<RequireAccess rule={ACCESS.customFields}><CustomFields /></RequireAccess>} />
          <Route path="/vertical-packs" element={<RequireAccess rule={ACCESS.verticalPacks}><VerticalPacks /></RequireAccess>} />
          <Route path="/vertical-packs/:id" element={<RequireAccess rule={ACCESS.verticalPacks}><PackDesigner /></RequireAccess>} />
          <Route path="/leads" element={<RequireAccess rule={ACCESS.leads}><Leads /></RequireAccess>} />
          <Route path="/leads/new" element={<RequireAccess rule={ACCESS.manageLeads}><LeadCreate /></RequireAccess>} />
          <Route path="/leads/:id" element={<RequireAccess rule={ACCESS.leads}><LeadDetail /></RequireAccess>} />
          <Route path="/opportunities" element={<RequireAccess rule={ACCESS.opportunities}><Opportunities /></RequireAccess>} />
          <Route path="/opportunities/:id" element={<RequireAccess rule={ACCESS.opportunities}><OpportunityDetail /></RequireAccess>} />
          <Route path="/quotations/:id" element={<RequireAccess rule={ACCESS.opportunities}><QuotationDetail /></RequireAccess>} />
          <Route path="/contracts" element={<RequireAccess rule={ACCESS.contracts}><Contracts /></RequireAccess>} />
          <Route path="/contracts/:id" element={<RequireAccess rule={ACCESS.contracts}><ContractDetail /></RequireAccess>} />
          <Route path="/offerings" element={<RequireAccess rule={ACCESS.offerings}><Offerings /></RequireAccess>} />
          <Route path="/invoices" element={<RequireAccess rule={ACCESS.invoices}><Invoices /></RequireAccess>} />
          <Route path="/invoices/new" element={<RequireAccess rule={ACCESS.manageInvoices}><InvoiceCreate /></RequireAccess>} />
          <Route path="/invoices/:id" element={<RequireAccess rule={ACCESS.invoices}><InvoiceDetail /></RequireAccess>} />
          <Route path="/payments" element={<RequireAccess rule={ACCESS.payments}><Payments /></RequireAccess>} />
          <Route path="/payments/new" element={<RequireAccess rule={ACCESS.recordPayments}><PaymentCreate /></RequireAccess>} />
          <Route path="/payments/:id" element={<RequireAccess rule={ACCESS.payments}><PaymentDetail /></RequireAccess>} />
          <Route path="/collections" element={<RequireAccess rule={ACCESS.collections}><Collections /></RequireAccess>} />
          <Route path="/customers" element={<RequireAccess rule={ACCESS.customers}><Customers /></RequireAccess>} />
          <Route path="/customers/new" element={<RequireAccess rule={ACCESS.manageCustomers}><CustomerCreate /></RequireAccess>} />
          <Route path="/customers/:id" element={<RequireAccess rule={ACCESS.customers}><CustomerDetail /></RequireAccess>} />
          <Route path="/client-services" element={<RequireAccess rule={ACCESS.clientServices}><ClientServices /></RequireAccess>} />
          <Route path="/service-providers" element={<RequireAccess rule={ACCESS.clientServices}><ServiceProviders /></RequireAccess>} />
          <Route path="/audit-log" element={<RequireAccess rule={ACCESS.auditLog}><AuditLog /></RequireAccess>} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
