import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrgChart } from '../api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'

const OPEN_LEVELS = 2 // how many levels start expanded

// Who reports to whom. The primary manager is the solid line; the managers of someone's other posts are dotted.
export default function OrgChart() {
  const { orgId } = useActiveOrg()
  const { units } = useAccessCatalog(orgId)
  const [search, setSearch] = useState('')
  const query = useQuery(['org-chart', orgId], ({ signal }) => getOrgChart({ signal }), { enabled: Boolean(orgId) })
  const unitNames = Object.fromEntries((units || []).map((u) => [u.id, u.name]))

  const { byId, solid, dotted, roots } = useMemo(() => {
    const nodes = query.data?.data ?? []
    const byId = Object.fromEntries(nodes.map((n) => [n.worker_id, n]))
    const solid = {}
    const dotted = {}
    for (const node of nodes) {
      if (node.manager_id) (solid[node.manager_id] ||= []).push(node)
      for (const managerId of node.dotted_manager_ids) (dotted[managerId] ||= []).push(node)
    }
    return { byId, solid, dotted, roots: nodes.filter((n) => !n.manager_id) }
  }, [query.data])

  const needle = search.trim().toLowerCase()
  const matches = needle ? Object.values(byId).filter((n) => `${n.name} ${n.designation}`.toLowerCase().includes(needle)) : []

  // `path` guards against a reporting loop in the data: a person already above is never drawn again.
  const renderNode = (node, depth, path) => {
    const reports = (solid[node.worker_id] || []).filter((n) => !path.has(n.worker_id))
    const dottedReports = (dotted[node.worker_id] || []).filter((n) => !path.has(n.worker_id))
    const person = (
      <span className="org-person">
        <Link to={`/people/employees/${node.worker_id}`}>{node.name}</Link>
        <span className="muted small"> · {node.designation}{node.unit_id ? ` · ${unitNames[node.unit_id] || ''}` : ''}</span>
        {node.extra_post_titles.length > 0 && <span className="muted small"> · also {node.extra_post_titles.join(', ')}</span>}
      </span>
    )
    if (!reports.length && !dottedReports.length) return <li key={node.worker_id} className="org-node">{person}</li>
    const next = new Set([...path, node.worker_id])
    return (
      <li key={node.worker_id} className="org-node">
        <details open={depth < OPEN_LEVELS}>
          <summary>{person} <span className="muted small">({reports.length + dottedReports.length})</span></summary>
          {reports.length > 0 && <ul>{reports.map((r) => renderNode(r, depth + 1, next))}</ul>}
          {dottedReports.length > 0 && (
            <>
              <div className="org-tree-label">Dotted line (through another post)</div>
              <ul className="dotted">
                {dottedReports.map((r) => (
                  <li key={`d-${r.worker_id}`} className="org-node">
                    <span className="org-person dotted">
                      <Link to={`/people/employees/${r.worker_id}`}>{r.name}</Link>
                      <span className="muted small"> · {r.designation}, reports to {byId[r.manager_id]?.name || 'nobody'} as primary</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      </li>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Org chart</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Solid lines are primary managers. Dashed lines are the managers of someone’s other posts.
          </p>
        </div>
      </div>
      <ErrorBanner error={query.error} onRetry={query.reload} />
      {query.loading ? (
        <DetailSkeleton lines={6} />
      ) : (
        <div className="panel">
          <div className="toolbar">
            <input type="search" placeholder="Find a person…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {query.data?.truncated && <div className="alert small">The organization is larger than this chart shows; some people are left out.</div>}
          {needle ? (
            matches.length === 0 ? (
              <div className="center-note">Nobody matches.</div>
            ) : (
              <ul className="org-tree">
                {matches.slice(0, 50).map((n) => (
                  <li key={n.worker_id} className="org-node">
                    <span className="org-person">
                      <Link to={`/people/employees/${n.worker_id}`}>{n.name}</Link>
                      <span className="muted small"> · {n.designation} · reports to {byId[n.manager_id]?.name || 'nobody'}
                        {n.dotted_manager_ids.length > 0 && `, dotted line to ${n.dotted_manager_ids.map((id) => byId[id]?.name).filter(Boolean).join(', ')}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : roots.length === 0 ? (
            <div className="center-note">No employees yet.</div>
          ) : (
            <ul className="org-tree">{roots.map((root) => renderNode(root, 0, new Set()))}</ul>
          )}
        </div>
      )}
    </div>
  )
}
