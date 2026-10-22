import { Link } from 'react-router-dom'
import { verticalsApi } from '@/features/verticals/api.js'
import VerticalsPanel from '@/features/verticals/components/VerticalsPanel.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// The client's verticals (industries), shared by all of its companies.
export default function Verticals() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const { data } = useLookup(
    ['verticals', orgId, 'options'],
    ({ signal }) => verticalsApi.list(orgId, {}, { signal }).catch(() => []),
    { enabled: Boolean(orgId) }
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Verticals</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The industries you work in, such as Construction or Interior design. They're shared by all your companies and private to
            your account. A custom field can be kept for some of them (on <Link to="/custom-fields">Custom fields</Link>), and branches
            and departments say which ones they work in (on <Link to="/org-units">Company structure</Link>).
          </p>
        </div>
      </div>

      {data === undefined ? (
        <PanelSkeleton lines={3} />
      ) : (
        <VerticalsPanel
          orgId={orgId}
          verticals={data}
          canManage={hasAccess(user, ACCESS.manageVerticals)}
          onChanged={() => invalidate(['verticals', orgId])}
        />
      )}
    </div>
  )
}
