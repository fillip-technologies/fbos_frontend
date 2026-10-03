import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { CONSOLE, useAuth } from './auth/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import AcceptInvitation from './pages/AcceptInvitation.jsx'
import OrganizationsList from './pages/client/OrganizationsList.jsx'
import OrganizationCreate from './pages/client/OrganizationCreate.jsx'
import OrganizationDetail from './pages/client/OrganizationDetail.jsx'
import Overview from './pages/org/Overview.jsx'
import Members from './pages/org/Members.jsx'

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center-note">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

// Each console's pages are only reachable when signed into that console.
function RequireConsole({ type }) {
  const { consoleType } = useAuth()
  return consoleType === type ? <Outlet /> : <Navigate to="/" replace />
}

function Home() {
  const { consoleType } = useAuth()
  return <Navigate to={consoleType === CONSOLE.CLIENT ? '/organizations' : '/overview'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route element={<RequireConsole type={CONSOLE.CLIENT} />}>
          <Route path="/organizations" element={<OrganizationsList />} />
          <Route path="/organizations/new" element={<OrganizationCreate />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
        </Route>
        <Route element={<RequireConsole type={CONSOLE.ORGANIZATION} />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/members" element={<Members />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
