import { useState } from 'react'
import { getWorkerPosts } from '../api.js'
import { POST_TYPE_LABELS, formatCurrency, formatDate, formatShare, statusLabel, toList } from '../utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// A role a post gives, with where it applies: "Sales Manager (its department)".
const roleWithScope = (spec, unitName) => {
  const name = spec.name || spec.role_code
  if (spec.scope === 'department') return `${name} (its department)`
  if (spec.scope === 'unit' && spec.unit_id) return `${name} (${unitName(spec.unit_id)})`
  return `${name} (whole company)`
}

// The jobs a person holds: the primary post first, then the others, with earlier versions on request.
// Posts change through role changes, so each action opens the Change role form already filled in.
export default function PostsTab({ workerId, canManage, canSeePay, canMakePrimary = true, unitName, onChange }) {
  const { orgId } = useActiveOrg()
  const [showEnded, setShowEnded] = useState(false)
  const query = useQuery(
    ['worker-posts', orgId, workerId, { showEnded }],
    ({ signal }) => getWorkerPosts(workerId, { include_ended: showEnded }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true },
  )
  const posts = toList(query.data)
  const live = posts.filter((p) => p.status === 'active')

  return (
    <div>
      <ErrorBanner error={query.error} onRetry={query.reload} />
      <div className="toolbar">
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />
          Show earlier versions and ended posts
        </label>
        {canManage && (
          <button type="button" className="btn" onClick={() => onChange({ action: 'add_post' })} style={{ marginLeft: 'auto' }}>
            Add a post
          </button>
        )}
      </div>
      <div className={`panel${query.refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              <th>Post</th>
              <th>Type</th>
              <th>Department</th>
              <th>Reports to</th>
              <th>Share of time</th>
              {canSeePay && <th className="right">Allowance / month</th>}
              <th>Dates</th>
              <th>Status</th>
              {canManage && <th className="right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {query.loading ? (
              <TableSkeleton cols={canManage ? 9 : 8} rows={3} />
            ) : posts.length === 0 ? (
              <tr><td colSpan={9} className="center-note">No posts.</td></tr>
            ) : (
              posts.map((post) => {
                const active = post.status === 'active'
                return (
                  <tr key={post.id} className={active ? undefined : 'post-ended'}>
                    <td>
                      <strong>{post.title}</strong>
                      {post.role_codes?.length > 0 && (
                        <div className="muted small">Gives: {post.role_codes.map((r) => roleWithScope(r, unitName)).join(', ')}</div>
                      )}
                    </td>
                    <td>{POST_TYPE_LABELS[post.post_type] || post.post_type}</td>
                    <td>{post.unit_id ? unitName(post.unit_id) : <span className="muted">—</span>}</td>
                    <td>{post.manager_name || <span className="muted">—</span>}</td>
                    <td>{post.time_share != null ? formatShare(post.time_share) : post.post_type === 'primary' && live.length > 1 ? 'The rest' : ''}</td>
                    {canSeePay && <td className="right">{post.monthly_allowance != null ? formatCurrency(post.monthly_allowance, 'INR') : ''}</td>}
                    <td className="small">
                      {formatDate(post.start_date)}{post.end_date ? ` – ${formatDate(post.end_date)}` : ' –'}
                    </td>
                    <td><StatusBadge status={post.status} label={statusLabel(post.status)} /></td>
                    {canManage && (
                      <td className="right">
                        {active && (
                          <div className="table-actions">
                            <button type="button" className="btn secondary small-btn" onClick={() => onChange({ action: 'change', postRef: post.post_ref })}>
                              Change
                            </button>
                            {post.post_type === 'concurrent' && canMakePrimary && (
                              <button type="button" className="btn secondary small-btn" onClick={() => onChange({ action: 'make_primary', postRef: post.post_ref })}>
                                Make primary
                              </button>
                            )}
                            {post.post_type !== 'primary' && (
                              <button type="button" className="btn danger-outline small-btn" onClick={() => onChange({ action: 'end_post', postRef: post.post_ref })}>
                                End
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>
        A person has one primary post and may hold more. Each change goes through approval, and a new post does not start until it is approved.
      </p>
    </div>
  )
}
