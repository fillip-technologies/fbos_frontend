import { useState } from 'react'
import { taxPacksApi } from '@/features/tax/api.js'
import { CONFIG_KINDS, PACK_ACTIONS, entrySummary } from '@/features/tax/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'

const changeKey = (change) => `${change.kind}|${change.code}|${change.effective_from}`

function describe(change, side) {
  const shape = change[side]
  if (!shape) return <span className="muted">—</span>
  return (
    <>
      {entrySummary(change.kind, shape.data)}
      <div className="muted">until {shape.effective_to ? formatDate(shape.effective_to) : 'open'}</div>
    </>
  )
}

// What a pack version would change, for an admin to read before applying it. Entries edited
// in this company are conflicts: kept unless ticked to take the pack's version.
function PackReview({ orgId, pack, onApplied, onClose }) {
  const { data: diff, error, loading } = useQuery(
    ['tax-pack-diff', orgId, pack.code, pack.latest_version],
    ({ signal }) => taxPacksApi.diff(orgId, pack.code, pack.latest_version, { signal }),
    { enabled: Boolean(orgId), staleTime: 0 }
  )
  const [overwrite, setOverwrite] = useState({})
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState(null)

  async function apply() {
    setApplying(true)
    setApplyError(null)
    try {
      const chosen = diff.changes
        .filter((change) => change.action === 'conflict' && overwrite[changeKey(change)])
        .map(({ kind, code, effective_from }) => ({ kind, code, effective_from }))
      await taxPacksApi.apply(orgId, { pack: pack.code, version: pack.latest_version, overwrite: chosen })
      onApplied()
    } catch (err) {
      setApplyError(err)
      setApplying(false)
    }
  }

  if (loading) return <PanelSkeleton />
  return (
    <div className="inline-panel">
      <h3>{pack.title} v{pack.latest_version}: what would change</h3>
      <ErrorBanner error={error || applyError} />
      {diff && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            {Object.entries(diff.summary)
              .filter(([action, count]) => count && action !== 'unchanged')
              .map(([action, count]) => `${count} to ${PACK_ACTIONS[action]?.toLowerCase() || action}`)
              .join(' · ') || 'Nothing changes.'}
            . Documents already issued keep their tax either way.
          </p>
          {diff.changes.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Change</th>
                    <th>Entry</th>
                    <th>Now</th>
                    <th>In the pack</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.changes.map((change) => (
                    <tr key={changeKey(change)} style={{ cursor: 'default' }}>
                      <td className="small">
                        <strong>{PACK_ACTIONS[change.action] || change.action}</strong>
                        {change.reason && <div className="muted">{change.reason}</div>}
                        {change.action === 'conflict' && (
                          <label className="inline-check small">
                            <input
                              type="checkbox"
                              checked={Boolean(overwrite[changeKey(change)])}
                              onChange={(e) => setOverwrite({ ...overwrite, [changeKey(change)]: e.target.checked })}
                            />
                            Take the pack’s version
                          </label>
                        )}
                      </td>
                      <td className="small">
                        <span className="mono">{change.code}</span>
                        <div className="muted">{CONFIG_KINDS[change.kind] || change.kind} · from {formatDate(change.effective_from)}</div>
                      </td>
                      <td className="small">{describe(change, 'current')}</td>
                      <td className="small">{describe(change, 'proposed')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={apply} disabled={applying} aria-busy={applying}>
              {applying ? 'Applying…' : `Apply v${pack.latest_version}`}
            </button>
            <button className="btn secondary" onClick={onClose} disabled={applying}>Close</button>
          </div>
        </>
      )}
    </div>
  )
}

// Packs are reviewed, versioned tax settings shipped with FBOS (India GST, India TDS, number
// formats). A new version is never applied by itself: it is reviewed here first.
export default function TaxPacks({ orgId, canManage }) {
  const { data, error, loading, reload } = useQuery(['tax-packs', orgId], ({ signal }) => taxPacksApi.list(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const [reviewing, setReviewing] = useState(null)

  if (loading) return <PanelSkeleton />
  return (
    <div className="panel">
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Packs</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Ready-made tax settings. Have your chartered accountant confirm a pack’s rates and dates before applying a new version.
      </p>
      <ErrorBanner error={error} onRetry={reload} />
      <table>
        <thead>
          <tr>
            <th>Pack</th>
            <th>Applied</th>
            <th>Latest</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((pack) => {
            const behind = pack.applied_version == null || pack.applied_version < pack.latest_version
            return (
              <tr key={pack.code} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{pack.title}</div>
                  <div className="muted small">{pack.description}</div>
                </td>
                <td>{pack.applied_version ? `v${pack.applied_version}` : <span className="muted">Not applied</span>}</td>
                <td>v{pack.latest_version}</td>
                <td>
                  {canManage && behind && reviewing?.code !== pack.code && (
                    <button className="btn small-btn" onClick={() => setReviewing(pack)}>Review v{pack.latest_version}…</button>
                  )}
                  {!behind && <span className="muted small">Up to date</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {reviewing && (
        <PackReview
          orgId={orgId}
          pack={reviewing}
          onClose={() => setReviewing(null)}
          onApplied={() => {
            setReviewing(null)
            invalidate(['tax-config', orgId])
            invalidate(['tax-entries', orgId])
            invalidate(['tax-revisions', orgId])
            reload()
          }}
        />
      )}
    </div>
  )
}
