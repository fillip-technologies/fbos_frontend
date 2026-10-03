import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { calendarsApi } from '@/features/calendars/api.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { usersApi } from '@/features/users/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { childTypesFor, isTopLevelType, parentCandidates, sortedTree, UNIT_TYPES, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'

// "Sales Team North" -> "SALES-TEAM-NORTH" (letters, digits and dashes only).
const suggestCode = (name) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

// The "no choice" option: a new unit takes its parent's calendar, and a branch takes the
// organization's (backend rule).
function inheritedLabel(parent, org, calendars) {
  const source = parent || org
  if (!source) return '— None —'
  const sourceName = parent ? parent.name : 'the company'
  const inherited = calendars.find((c) => c.id === source.calendar_id)
  return inherited ? `— Same as ${sourceName}: ${inherited.name} —` : `— Same as ${sourceName} (none) —`
}

export default function OrgUnitCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { orgId, activeOrg } = useActiveOrg()

  const [units, setUnits] = useState([])
  const [people, setPeople] = useState([])
  const [calendars, setCalendars] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState({ unit_type: UNIT_TYPE_LABELS[params.get('type')] ? params.get('type') : '', parent_id: params.get('parent') || null, name: '', code: '', head_user_id: '', calendar_id: '' })
  const [codeTouched, setCodeTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    Promise.all([
      orgUnitsApi.listAll(orgId),
      // Picking a head needs user read access; without it the field is simply left out.
      usersApi.list(orgId, { limit: 100, status: 'active' }).then((r) => r.data).catch(() => null),
      // Likewise the calendar field needs calendar read access.
      calendarsApi.list(orgId).catch(() => null),
    ])
      .then(([u, p, c]) => {
        setUnits(sortedTree(u))
        setPeople(p)
        setCalendars(c)
      })
      .catch(setLoadError)
      .finally(() => setLoading(false))
  }, [orgId])

  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const parent = form.parent_id ? unitsById[form.parent_id] : null

  // Coming from "+ Add under": default the type to the first one allowed under that parent.
  useEffect(() => {
    if (parent && !form.unit_type) {
      const [first] = childTypesFor(parent.unit_type)
      if (first) setForm((f) => ({ ...f, unit_type: first }))
    }
  }, [parent, form.unit_type])

  const typeOptions = parent ? UNIT_TYPES.filter((t) => childTypesFor(parent.unit_type).includes(t.value)) : UNIT_TYPES
  const candidates = form.unit_type ? parentCandidates(units, form.unit_type) : []
  const needsParent = form.unit_type && !isTopLevelType(form.unit_type)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  function setType(unitType) {
    setForm((f) => {
      const next = { ...f, unit_type: unitType }
      // Drop a parent the new type can't sit under.
      if (isTopLevelType(unitType) || (f.parent_id && !parentCandidates(units, unitType).some((u) => u.id === f.parent_id))) {
        next.parent_id = null
      }
      return next
    })
  }
  function setName(name) {
    setForm((f) => ({ ...f, name, code: codeTouched ? f.code : suggestCode(name) }))
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      unit_type: form.unit_type,
      parent_id: needsParent ? form.parent_id : null,
    }
    if (form.head_user_id) body.head_user_id = form.head_user_id
    if (form.calendar_id) body.calendar_id = form.calendar_id
    try {
      const unit = await orgUnitsApi.create(orgId, body)
      navigate(`/org-units/${unit.id}`, { state: { notice: `${UNIT_TYPE_LABELS[unit.unit_type]} “${unit.name}” created.` } })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (loadError) return <ErrorBanner error={loadError} />

  const hasBranch = units.some((u) => isTopLevelType(u.unit_type) && u.status === 'active')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Add to company structure</h1>
          {parent && <p className="muted small" style={{ margin: '4px 0 0' }}>Under {parent.name} ({UNIT_TYPE_LABELS[parent.unit_type]})</p>}
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          <Link className="btn secondary" to="/org-units">← Back</Link>
        </div>
      </div>

      <form className="panel" onSubmit={submit} style={{ maxWidth: 720 }}>
        {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

        <div className="field">
          <label>Type *</label>
          <div className="type-cards">
            {typeOptions.map((t) => {
              const disabled = !isTopLevelType(t.value) && !hasBranch && !parent
              return (
                <label key={t.value} className={`type-card${form.unit_type === t.value ? ' selected' : ''}${disabled ? ' disabled' : ''}`}>
                  <input type="radio" name="unit_type" value={t.value} checked={form.unit_type === t.value} disabled={disabled} onChange={() => setType(t.value)} />
                  <strong>{t.label}</strong>
                  <span className="muted small">{t.help}</span>
                </label>
              )
            })}
          </div>
          {!hasBranch && !parent && <div className="hint">Create a branch first; departments and teams sit under it.</div>}
          {fieldErrors.unit_type && <div className="field-error">{fieldErrors.unit_type}</div>}
        </div>

        {needsParent && (
          <div className="field">
            <label htmlFor="u-parent">Sits under *</label>
            <UnitSelect
              id="u-parent"
              units={candidates}
              value={form.parent_id}
              emptyLabel={candidates.length ? '— Choose where it sits —' : '— No valid parent exists yet —'}
              onChange={(id) => set('parent_id', id)}
            />
            <div className="hint">
              A {UNIT_TYPE_LABELS[form.unit_type].toLowerCase()} can sit under:{' '}
              {{ department: 'a branch or another department', team: 'a department' }[form.unit_type]}.
            </div>
            {fieldErrors.parent_id && <div className="field-error">{fieldErrors.parent_id}</div>}
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <label htmlFor="u-name">Name *</label>
            <input id="u-name" value={form.name} onChange={(e) => setName(e.target.value)} required maxLength={255} placeholder="Sales" />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="u-code">Code *</label>
            <input
              id="u-code"
              className="mono-input"
              value={form.code}
              onChange={(e) => {
                setCodeTouched(true)
                set('code', e.target.value)
              }}
              required
              pattern="[A-Za-z0-9\-]+"
              maxLength={100}
              placeholder="SALES"
            />
            <div className="hint">Letters, digits and dashes. Unique in this company; it can't be changed later.</div>
            {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
          </div>
        </div>

        <div className="grid-2">
          {people && (
            <div className="field">
              <label htmlFor="u-head">Head</label>
              <select id="u-head" value={form.head_user_id} onChange={(e) => set('head_user_id', e.target.value)}>
                <option value="">— None for now —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                ))}
              </select>
              {fieldErrors.head_user_id && <div className="field-error">{fieldErrors.head_user_id}</div>}
            </div>
          )}
          {calendars && (
            <div className="field">
              <label htmlFor="u-cal">Working calendar</label>
              <select id="u-cal" value={form.calendar_id} onChange={(e) => set('calendar_id', e.target.value)}>
                <option value="">{inheritedLabel(needsParent ? parent : null, activeOrg, calendars)}</option>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.timezone})</option>
                ))}
              </select>
              {calendars.length === 0 && <div className="hint">No calendars yet. <Link to="/calendars">Create one</Link>.</div>}
              {fieldErrors.calendar_id && <div className="field-error">{fieldErrors.calendar_id}</div>}
            </div>
          )}
        </div>

        <div className="row-actions">
          <button className="btn" type="submit" disabled={saving || !form.unit_type || (needsParent && !form.parent_id)}>
            {saving ? 'Creating…' : form.unit_type ? `Create ${UNIT_TYPE_LABELS[form.unit_type].toLowerCase()}` : 'Create'}
          </button>
          <Link className="btn secondary" to="/org-units">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
