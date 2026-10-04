import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { canSetVerticals, effectiveVerticals, sortedTree, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Where one vertical applies in the company: tick the branches and departments that work in
// it. Units under a ticked one inherit it unless they set their own; teams always follow
// their department. Each tick changes only this vertical on the unit, keeping its others.
export default function VerticalUnits({ orgId, vertical, companyName, canAssign }) {
  const [units, setUnits] = useState(null)
  const [saving, setSaving] = useState(null) // unit id
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    orgUnitsApi
      .listAll(orgId)
      .then((all) => setUnits(all.filter((u) => u.status === 'active')))
      .catch(setError)
  }, [orgId])
  useEffect(load, [load])

  const unitsById = useMemo(() => Object.fromEntries((units || []).map((u) => [u.id, u])), [units])
  const rows = useMemo(() => sortedTree(units || []), [units])

  async function toggle(unit, on) {
    const ids = on ? [...unit.vertical_ids, vertical.id] : unit.vertical_ids.filter((id) => id !== vertical.id)
    setSaving(unit.id)
    setError(null)
    try {
      await orgUnitsApi.setVerticals(orgId, unit.id, ids)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(null)
    }
  }

  const applies = rows.filter((u) => effectiveVerticals(u, unitsById).ids.includes(vertical.id))

  return (
    <div className="panel role-card">
      <div className="section-head">
        <div>
          <h2>Where “{vertical.name}” applies in {companyName}</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            This pack's fields show only in branches and departments that work in {vertical.name}. Tick them here;
            everything under a ticked unit follows it unless it sets its own.
          </p>
        </div>
      </div>
      <ErrorBanner error={error} onRetry={load} />

      {!units ? (
        !error && <div className="muted small">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          This company has no branches yet. <Link to="/org-units">Set up the company structure</Link> first.
        </p>
      ) : (
        <>
          <table className="compact">
            <thead>
              <tr>
                <th>Unit</th>
                <th style={{ width: 120 }}>Type</th>
                <th style={{ width: 120 }}>Works in it</th>
                <th>Applies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const { ids, from } = effectiveVerticals(u, unitsById)
                const own = u.vertical_ids.includes(vertical.id)
                const inherited = !own && ids.includes(vertical.id)
                // A unit with its own verticals no longer inherits; say so when the parent has this one.
                const overridden = !own && !ids.includes(vertical.id) && u.vertical_ids.length > 0
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="tree-cell" style={{ paddingLeft: u.depth * 22 }}>
                        {u.depth > 0 && <span className="tree-branch" aria-hidden="true">└</span>}
                        <Link to={`/org-units/${u.id}`}>{u.name}</Link>
                      </div>
                    </td>
                    <td>{UNIT_TYPE_LABELS[u.unit_type] || u.unit_type}</td>
                    <td>
                      {canSetVerticals(u.unit_type) ? (
                        <input
                          type="checkbox"
                          checked={own}
                          disabled={!canAssign || saving === u.id}
                          onChange={(e) => toggle(u, e.target.checked)}
                          aria-label={`${u.name} works in ${vertical.name}`}
                        />
                      ) : (
                        <span className="muted small">follows department</span>
                      )}
                    </td>
                    <td className="small">
                      {own && <span className="badge active">Yes</span>}
                      {inherited && <span className="muted">Yes, from {from.name}</span>}
                      {overridden && <span className="muted">No: it sets other verticals</span>}
                      {!own && !inherited && !overridden && <span className="muted">No</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {applies.length
              ? `Applies in ${applies.length} of ${rows.length} unit${rows.length === 1 ? '' : 's'}.`
              : 'Not applied anywhere yet.'}
            {!canAssign && ' You need permission to edit the company structure to change this.'}
          </p>
        </>
      )}
    </div>
  )
}
