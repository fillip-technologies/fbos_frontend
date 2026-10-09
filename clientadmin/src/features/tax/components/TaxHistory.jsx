import { taxConfigApi } from '@/features/tax/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

// Every change to the tax configuration, newest first. Documents record the revision their
// taxes were worked out under.
export default function TaxHistory({ orgId }) {
  const { data, error, loading, reload } = useQuery(['tax-revisions', orgId], ({ signal }) => taxConfigApi.revisions(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <ErrorBanner error={error} onRetry={reload} />
      <table>
        <thead>
          <tr>
            <th>Revision</th>
            <th>Change</th>
            <th>Source</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeleton cols={4} rows={5} />
          ) : (data ?? []).length === 0 ? (
            <tr><td colSpan={4} className="center-note">No changes yet.</td></tr>
          ) : (
            data.map((revision) => (
              <tr key={revision.revision} style={{ cursor: 'default' }}>
                <td className="mono">{revision.revision}</td>
                <td>{revision.summary}</td>
                <td className="small">{revision.source === 'manual' ? 'Edited here' : revision.source.replace('pack:', 'Pack ')}</td>
                <td className="small">{new Date(revision.changed_at).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
