import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import Layout from '@/app/layout/Layout.jsx'
import RequireAccess from '@/features/auth/components/RequireAccess.jsx'
import { ACCESS } from '@/features/auth/access.js'
import Login from '@/features/auth/pages/Login.jsx'
import ForgotPassword from '@/features/auth/pages/ForgotPassword.jsx'
import SetPassword from '@/features/auth/pages/SetPassword.jsx'
import Dashboard from '@/features/dashboard/pages/Dashboard.jsx'
import Organizations from '@/features/organizations/pages/Organizations.jsx'
import OrganizationCreate from '@/features/organizations/pages/OrganizationCreate.jsx'
import OrganizationDetail from '@/features/organizations/pages/OrganizationDetail.jsx'
import Users from '@/features/users/pages/Users.jsx'
import UserInvite from '@/features/users/pages/UserInvite.jsx'
import UserDetail from '@/features/users/pages/UserDetail.jsx'
import Roles from '@/features/access/pages/Roles.jsx'
import OrgUnits from '@/features/org-units/pages/OrgUnits.jsx'
import OrgUnitCreate from '@/features/org-units/pages/OrgUnitCreate.jsx'
import OrgUnitDetail from '@/features/org-units/pages/OrgUnitDetail.jsx'
import Calendars from '@/features/calendars/pages/Calendars.jsx'
import CustomFields from '@/features/verticals/pages/CustomFields.jsx'
import VerticalPacks from '@/features/verticals/pages/VerticalPacks.jsx'
import PackDesigner from '@/features/verticals/pages/PackDesigner.jsx'
import AuditLog from '@/features/audit-log/pages/AuditLog.jsx'
import Profile from '@/features/profile/pages/Profile.jsx'
import Customers from '@/features/customers/pages/Customers.jsx'
import CustomerCreate from '@/features/customers/pages/CustomerCreate.jsx'
import CustomerDetail from '@/features/customers/pages/CustomerDetail.jsx'
import ClientServices from '@/features/customers/pages/ClientServices.jsx'
import ServiceProviders from '@/features/customers/pages/ServiceProviders.jsx'
import Leads from '@/features/sales/pages/Leads.jsx'
import LeadCreate from '@/features/sales/pages/LeadCreate.jsx'
import LeadDetail from '@/features/sales/pages/LeadDetail.jsx'
import Opportunities from '@/features/sales/pages/Opportunities.jsx'
import OpportunityDetail from '@/features/sales/pages/OpportunityDetail.jsx'
import QuotationDetail from '@/features/sales/pages/QuotationDetail.jsx'
import Contracts from '@/features/sales/pages/Contracts.jsx'
import ContractDetail from '@/features/sales/pages/ContractDetail.jsx'
import Offerings from '@/features/sales/pages/Offerings.jsx'
import Invoices from '@/features/billing/pages/Invoices.jsx'
import InvoiceCreate from '@/features/billing/pages/InvoiceCreate.jsx'
import InvoiceDetail from '@/features/billing/pages/InvoiceDetail.jsx'
import Payments from '@/features/billing/pages/Payments.jsx'
import PaymentCreate from '@/features/billing/pages/PaymentCreate.jsx'
import PaymentDetail from '@/features/billing/pages/PaymentDetail.jsx'
import Collections from '@/features/billing/pages/Collections.jsx'
import { ActiveOrgProvider } from '@/features/organizations/ActiveOrg.jsx'

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center-note">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export default function App() {
  return (
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
  )
}
