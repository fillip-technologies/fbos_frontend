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
import Profile from '@/features/profile/pages/Profile.jsx'
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
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
