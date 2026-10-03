import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import MyHome from '@/features/dashboard/components/MyHome.jsx'
import SubscriptionOverview from '@/features/dashboard/components/SubscriptionOverview.jsx'

// "/" — client admins see the client's subscription and quotas; everyone else a home
// page built from their own access.
export default function Dashboard() {
  const { user } = useAuth()
  return hasAccess(user, ACCESS.subscription) ? <SubscriptionOverview /> : <MyHome />
}
