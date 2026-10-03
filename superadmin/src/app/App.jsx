import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import Layout from '@/app/layout/Layout.jsx'
import Login from '@/features/auth/pages/Login.jsx'
import ClientsList from '@/features/clients/pages/ClientsList.jsx'
import ClientCreate from '@/features/clients/pages/ClientCreate.jsx'
import ClientDetail from '@/features/clients/pages/ClientDetail.jsx'

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
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/clients" replace />} />
        <Route path="/clients" element={<ClientsList />} />
        <Route path="/clients/new" element={<ClientCreate />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
