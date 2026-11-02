import { getPostsReport } from '../api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

const fte = (value) => Number(value).toFixed(2).replace(/\.?0+$/, '') || '0'

// Posts and FTE by department: who holds a post there, the posts by kind, the time they allocate,
// and the seats' budget against what is used.
export default function PostsReport() {
  const { orgId } = useActiveOrg()
  const { units } = useAccessCatalog(orgId)
  const query = useQuery(['posts-report', orgId], ({ signal }) => getPostsReport({ signal }), { enabled: Boolean(orgId) })
  const unitNames = Object.fromEntries((units || []).map((u) => [u.id, u.name]))
  const rows = query.data?.data ?? []
  const totals = query.data?.totals

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Posts and FTE</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            A post counts in the department it names; a seat in the department it sits in. Acting and additional-charge posts cover work and add no FTE.
          </p>
        </div>
      </div>
      <ErrorBanner error={query.error} onRetry={query.reload} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              <th>Department</th>
              <th className="right">People</th>
              <th className="right">Primary</th>
              <th className="right">Concurrent</th>
              <th className="right">Additional charge</th>
              <th className="right">Acting</th>
              <th className="right">FTE allocated</th>
              <th className="right">Seats budget</th>
              <th className="right">Seats used</th>
              <th className="right">Open</th>
            </tr>
          </thead>
          <tbody>
            {query.loading ? (
              <TableSkeleton cols={10} rows={4} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="center-note">Nothing to report yet.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.unit_id || 'none'}>
                  <td>{row.unit_id ? unitNames[row.unit_id] || 'Another department' : <span className="muted">No department</span>}</td>
                  <td className="right">{row.people}</td>
                  <td className="right">{row.primary_posts}</td>
                  <td className="right">{row.concurrent_posts}</td>
                  <td className="right">{row.additional_charge_posts}</td>
                  <td className="right">{row.acting_posts}</td>
                  <td className="right">{fte(row.allocated_fte)}</td>
                  <td className="right">{fte(row.budgeted_fte)}</td>
                  <td className="right">{fte(row.seat_used_fte)}</td>
                  <td className="right">{fte(row.open_fte)}</td>
                </tr>
              ))
            )}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr>
                <th>Everyone</th>
                <th className="right">{totals.people}</th>
                <th className="right" colSpan={4}>{totals.posts} posts</th>
                <th className="right">{fte(totals.allocated_fte)}</th>
                <th className="right">{fte(totals.budgeted_fte)}</th>
                <th className="right">{fte(totals.seat_used_fte)}</th>
                <th />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
