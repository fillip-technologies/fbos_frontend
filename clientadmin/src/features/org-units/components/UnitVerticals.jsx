import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { canSetVerticals, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'

// Which verticals (industries) a unit works in. Pack fields for a vertical apply only in
// units that work in it. Units without their own inherit from the nearest parent.
export default function UnitVerticals({ orgId, unit, canUpdate, onChanged }) {
  const [resolved, setResolved] = useState(null)
  const [options, setOptions] = useState([])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    Promise.all([orgUnitsApi.verticals(orgId, unit.id), orgUnitsApi.verticalOptions(orgId)])
      .then(([r, o]) => {
        setResolved(r)
        setOptions(o)
      })
      .catch(setError)
  }, [orgId, unit.id])
  useEffect(load, [load])

  const settable = canSetVerticals(unit.unit_type)
  const typeLabel = (UNIT_TYPE_LABELS[unit.unit_type] || 'unit').toLowerCase()

  return (
    <div className="panel form-section">
      <div className="section-head">
        <div>
          <h2>Verticals</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            The industries this {typeLabel} works in. Custom fields from a vertical's packs apply only where that vertical is set.
          </p>
        </div>
        {settable && canUpdate && unit.status === 'active' && !editing && resolved && (
          <button className="btn secondary" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>
      <ErrorBanner error={error} onRetry={load} />

      {!resolved ? (
        !error && <div className="muted small">Loading…</div>
      ) : editing ? (
        <VerticalsForm
          orgId={orgId}
          unit={unit}
          resolved={resolved}
          options={options}
          onCancel={() => setEditing(false)}
          onSaved={(r) => {
            setResolved(r)
            setEditing(false)
            onChanged?.()
          }}
        />
      ) : (
        <VerticalsSummary resolved={resolved} settable={settable} hasOptions={options.length > 0} />
      )}
    </div>
  )
}

function VerticalsSummary({ resolved, settable, hasOptions }) {
  const { effective, inherited_from: from, own } = resolved
  const archivedOwn = own.filter((v) => v.status !== 'active')
  return (
    <>
      {effective.length > 0 ? (
        <div className="chips">
          {effective.map((v) => <span key={v.id} className={`chip${from ? ' subtle' : ''}`}>{v.name}</span>)}
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          None yet, so only custom fields that aren't tied to a vertical apply here.
          {!hasOptions && <> Add verticals on <Link to="/vertical-packs">Vertical packs</Link> first.</>}
        </p>
      )}
      {from && (
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Inherited from <Link to={`/org-units/${from.id}`}>{from.name}</Link>
          {settable ? '. Set this unit\'s own to override.' : '. Teams always follow their department.'}
        </p>
      )}
      {!settable && !from && effective.length === 0 && (
        <p className="muted small" style={{ margin: '4px 0 0' }}>Teams follow their department's verticals.</p>
      )}
      {archivedOwn.length > 0 && (
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Archived and no longer applied: {archivedOwn.map((v) => v.name).join(', ')}.
        </p>
      )}
    </>
  )
}

function VerticalsForm({ orgId, unit, resolved, options, onCancel, onSaved }) {
  const ownIds = resolved.own.map((v) => v.id)
  const [selected, setSelected] = useState(() => new Set(ownIds))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  // Archived verticals can stay where they are set but can't be newly picked.
  const choices = options.filter((v) => v.status === 'active' || ownIds.includes(v.id))

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(await orgUnitsApi.setVerticals(orgId, unit.id, [...selected]))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <ErrorBanner error={error && Object.keys(fieldErrors).length === 0 ? error : null} />
      {Object.values(fieldErrors).map((issue) => <div key={issue} className="field-error">{issue}</div>)}
      {choices.length === 0 ? (
        <p className="muted small">No verticals yet. Add them on <Link to="/vertical-packs">Vertical packs</Link>.</p>
      ) : (
        <div className="vertical-choices">
          {choices.map((v) => (
            <label key={v.id} className="inline-check">
              <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
              {v.name}{v.status !== 'active' && <span className="badge archived">archived</span>}
            </label>
          ))}
        </div>
      )}
      <p className="muted small">
        {selected.size === 0
          ? resolved.inherited_from || unit.parent_id
            ? 'Nothing ticked: this unit will inherit its parent\'s verticals.'
            : 'Nothing ticked: no verticals apply to this branch.'
          : 'Departments and teams under this unit inherit these unless they set their own.'}
      </p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save verticals'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
