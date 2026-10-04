import { useEffect, useState } from 'react'
import { verticalPacksApi } from '@/features/verticals/api.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PLAN_ACTIONS } from '@/features/verticals/utils.js'

// Install (or change) the version of a pack this company runs. Shows exactly what will
// change before anything is written; installing the version already installed is a no-op.
export default function InstallPanel({ orgId, pack, companyName, typeName, onInstalled, onCancel }) {
  const published = pack.versions.filter((v) => v.status === 'published').map((v) => v.version_no).reverse()
  const [versionNo, setVersionNo] = useState(pack.latest_published_version)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!versionNo) return
    let cancelled = false
    setLoading(true)
    setError(null)
    verticalPacksApi
      .preview(orgId, pack.id, versionNo)
      .then((p) => !cancelled && setPreview(p))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [orgId, pack.id, versionNo])

  const installed = pack.installation?.version_no
  const nothingChanges = preview?.items.every((i) => i.action === 'unchanged')

  async function install() {
    setInstalling(true)
    setError(null)
    try {
      onInstalled(await verticalPacksApi.install(orgId, pack.id, versionNo))
    } catch (err) {
      setError(err)
    } finally {
      setInstalling(false)
    }
  }

  if (!published.length) {
    return (
      <div className="install-panel">
        <p className="muted small">Publish a version of this pack before installing it.</p>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    )
  }

  return (
    <div className="install-panel">
      <div className="toolbar">
        <label className="muted small" htmlFor={`install-${pack.id}`}>Install in {companyName}:</label>
        <select id={`install-${pack.id}`} value={versionNo} onChange={(e) => setVersionNo(Number(e.target.value))}>
          {published.map((n) => (
            <option key={n} value={n}>
              Version {n}{n === pack.latest_published_version ? ' (latest)' : ''}{n === installed ? ' (installed)' : ''}
            </option>
          ))}
        </select>
        {installed && <span className="muted small">Currently on version {installed}.</span>}
      </div>

      <ErrorBanner error={error} />
      {loading ? (
        <div className="muted small">Checking what will change…</div>
      ) : preview && (
        <>
          <PlanList items={preview.items} typeName={typeName} />
          {preview.items.some((i) => i.removed_fields.length) && (
            <p className="muted small">Removed and retired fields stop showing on forms. Values already entered in them are kept.</p>
          )}
        </>
      )}

      <div className="row-actions">
        <button className="btn" type="button" onClick={install} disabled={installing || loading || !preview || nothingChanges}>
          {installing ? 'Installing…' : nothingChanges ? 'Already up to date' : installed ? `Switch to version ${versionNo}` : `Install version ${versionNo}`}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// One line per record type: what happens to its custom fields.
export function PlanList({ items, typeName }) {
  if (!items.length) return <p className="muted small">This version has no sections.</p>
  return (
    <table className="compact">
      <tbody>
        {items.map((item) => {
          const action = PLAN_ACTIONS[item.action]
          return (
            <tr key={item.object_type}>
              <td style={{ width: 200 }}>{typeName[item.object_type] || item.object_type}</td>
              <td style={{ width: 140 }}><span className={`badge ${action.badge}`}>{action.label}</span></td>
              <td>
                <FieldChips label="Adds" keys={item.added_fields} />
                <FieldChips label="Changes" keys={item.changed_fields} />
                <FieldChips label="Removes" keys={item.removed_fields} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FieldChips({ label, keys }) {
  if (!keys.length) return null
  return (
    <div className="chips" style={{ margin: '2px 0' }}>
      <span className="muted small">{label}:</span>
      {keys.map((k) => <span key={k} className="chip">{k}</span>)}
    </div>
  )
}
