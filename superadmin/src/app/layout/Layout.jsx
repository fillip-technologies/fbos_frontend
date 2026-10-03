import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext.jsx'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          FBOS <small>Super Admin</small>
        </div>
        <div className="user">
          <span>
            {user?.name} · <span className="mono">{user?.email}</span>
          </span>
          <button className="btn ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
