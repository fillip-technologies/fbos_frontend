import { hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

// Route-level guard: blocks a page the signed-in user's rules don't allow, even when the
// URL is typed directly. The sidebar hides the same items using the same rule.
export default function RequireAccess({ rule, children }) {
  const { user } = useAuth()
  if (hasAccess(user, rule)) return children
  return (
    <div className="panel" style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>You don't have access to this page</h1>
      <p className="muted">Ask your client administrator to grant you the required permission.</p>
    </div>
  )
}
