import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import RequireAccess from './components/RequireAccess.jsx'
import { ACCESS } from './auth/access.js'
import Login from './pages/Login.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import SetPassword from './pages/SetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Organizations from './pages/Organizations.jsx'
import OrganizationCreate from './pages/OrganizationCreate.jsx'
import OrganizationDetail from './pages/OrganizationDetail.jsx'
import Users from './pages/Users.jsx'
import UserInvite from './pages/UserInvite.jsx'
import UserDetail from './pages/UserDetail.jsx'
import Roles from './pages/Roles.jsx'
import OrgUnits from './pages/OrgUnits.jsx'
import OrgUnitCreate from './pages/OrgUnitCreate.jsx'
import OrgUnitDetail from './pages/OrgUnitDetail.jsx'
import Calendars from './pages/Calendars.jsx'
import Profile from './pages/Profile.jsx'
import { ActiveOrgProvider } from './auth/ActiveOrg.jsx'

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
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
