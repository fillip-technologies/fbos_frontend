import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import MyHome from '@/features/dashboard/components/MyHome.jsx'
import SubscriptionOverview from '@/features/dashboard/components/SubscriptionOverview.jsx'

const LANDED_KEY = 'fbos_landed'

function alreadyLanded() {
  try {
    return sessionStorage.getItem(LANDED_KEY) === '1'
  } catch {
    return true // storage blocked: never redirect, so the dashboard stays reachable
  }
}

// "/" — client admins see the client's subscription and quotas; everyone else a home
// page built from their own access. Whoever may open the CEO Command Center lands on it
// the first time they open FBOS in a tab; the Dashboard stays one click away in the sidebar.
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [landOnCeo] = useState(() => hasAccess(user, ACCESS.ceoDashboard) && !alreadyLanded())
  useEffect(() => {
    if (!landOnCeo) return
    try {
      sessionStorage.setItem(LANDED_KEY, '1')
    } catch {
      // Nothing to remember; the redirect below still happens once.
    }
    navigate('/ceo', { replace: true })
  }, [landOnCeo, navigate])
  if (landOnCeo) return null
  return hasAccess(user, ACCESS.subscription) ? <SubscriptionOverview /> : <MyHome />
}
