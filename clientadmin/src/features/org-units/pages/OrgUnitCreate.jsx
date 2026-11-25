import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { calendarsApi } from '@/features/calendars/api.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import TypeIcon from '@/features/org-units/components/TypeIcon.jsx'
import { usersApi } from '@/features/users/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import '@/features/org-units/org-units.css'
import { breadcrumb, childTypesFor, isTopLevelType, parentCandidates, sortedTree, UNIT_TYPES, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'

// What each kind of unit is, in plain words, with examples.
const TYPE_GUIDE = {
  branch: {
    line: 'An office or a location.',
    examples: 'Patna office, Mumbai office',
    note: 'Sits directly under the company. Departments and teams go under a branch.',
  },
  department: {
    line: 'A function of the business.',
    examples: 'Sales, Finance, Digital Marketing',
    note: 'Sits under a branch or another department, and can hold teams.',
  },
  team: {
    line: 'A group of people who do the work.',
    examples: 'SMM, SEO, Backend',
    note: 'Sits under a department. Work is routed to teams, and people can also join a team as an extra member.',
  },
}

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

// A numbered step: what to do here, in a line.
function Step({ n, title, hint, children }) {
  return (
    <section className="ouc-step">
      <header>
        <span className="ouc-num">{n}</span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export default function OrgUnitCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()

  const enabled = Boolean(orgId)
  const unitsQuery = useLookup(['org-units', orgId, 'all'], ({ signal }) => orgUnitsApi.listAll(orgId, { signal }), { enabled })
  // Picking a head needs user read access; without it the list isn't requested and the
  // field is simply left out.
  const canReadPeople = enabled && hasAccess(me, ACCESS.users)
  const peopleQuery = useLookup(
    ['users', orgId, { status: 'active', limit: 100 }],
    ({ signal }) => usersApi.list(orgId, { limit: 100, status: 'active' }, { signal }).catch(() => ({ data: null })),
    { enabled: canReadPeople }
  )
  // Likewise the calendar field needs calendar read access.
  const canReadCalendars = enabled && hasAccess(me, ACCESS.calendars)
  const calendarsQuery = useLookup(['calendars', orgId], ({ signal }) => calendarsApi.list(orgId, { signal }), {
    enabled: canReadCalendars,
  })
  const units = useMemo(() => (unitsQuery.data ? sortedTree(unitsQuery.data) : []), [unitsQuery.data])
  const people = peopleQuery.data?.data ?? null
  const calendars = calendarsQuery.data ?? null
  const loading =
    unitsQuery.loading || (canReadPeople && peopleQuery.loading) || (canReadCalendars && calendarsQuery.loading && !calendarsQuery.error)
  const loadError = unitsQuery.error
  const [form, setForm] = useState({ unit_type: UNIT_TYPE_LABELS[params.get('type')] ? params.get('type') : '', parent_id: params.get('parent') || null, name: '', code: '', head_user_id: '', calendar_id: '' })
  const [codeTouched, setCodeTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

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
      invalidate(['org-units', orgId])
      navigate(`/org-units/${unit.id}`, { state: { notice: `${UNIT_TYPE_LABELS[unit.unit_type]} “${unit.name}” created.` } })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorBanner error={loadError} onRetry={unitsQuery.reload} />
  if (loading) return <DetailSkeleton />

  const hasBranch = units.some((u) => isTopLevelType(u.unit_type) && u.status === 'active')
  const guide = TYPE_GUIDE[form.unit_type]
  const typeName = form.unit_type ? UNIT_TYPE_LABELS[form.unit_type].toLowerCase() : 'unit'
  const head = people?.find((p) => p.id === form.head_user_id)
  const calendar = calendars?.find((c) => c.id === form.calendar_id)
  // Where it will sit, from the company down to the new unit.
  const above = needsParent && parent ? [...breadcrumb(parent, unitsById), parent] : []
  let step = 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Add to company structure</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {parent
              ? `Adding under ${parent.name} (${UNIT_TYPE_LABELS[parent.unit_type]}).`
              : 'Choose what you are adding, say where it sits, then name it. Only the type and the name are needed.'}
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          <Link className="btn secondary" to="/org-units">← Back</Link>
        </div>
      </div>

      <div className="ouc">
        <form className="ouc-form" onSubmit={submit}>
          {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

          <Step n={++step} title="What are you adding?" hint="Pick the kind that fits. The colour is the same on the structure chart.">
            <div className="ouc-types" role="radiogroup" aria-label="Type">
              {typeOptions.map((t) => {
                const disabled = !isTopLevelType(t.value) && !hasBranch && !parent
                const g = TYPE_GUIDE[t.value]
                return (
                  <label key={t.value} className={`ouc-type ou-${t.value}${form.unit_type === t.value ? ' selected' : ''}${disabled ? ' disabled' : ''}`}>
                    <input type="radio" name="unit_type" value={t.value} checked={form.unit_type === t.value} disabled={disabled} onChange={() => setType(t.value)} />
                    <span className="ouc-type-icon"><TypeIcon type={t.value} size={20} /></span>
                    <strong>{t.label}</strong>
                    <span className="ouc-type-line">{g.line}</span>
                    <span className="ouc-type-eg">e.g. {g.examples}</span>
                  </label>
                )
              })}
            </div>
            {!hasBranch && !parent && <div className="hint">There is no branch yet. Create a branch first: departments and teams sit under it.</div>}
            {fieldErrors.unit_type && <div className="field-error">{fieldErrors.unit_type}</div>}
          </Step>

          {needsParent && (
            <Step n={++step} title={`Where does the ${typeName} sit?`} hint={guide?.note}>
              <div className="field">
                <label htmlFor="u-parent">Sits under *</label>
                <UnitSelect
                  id="u-parent"
                  units={candidates}
                  value={form.parent_id}
                  emptyLabel={candidates.length ? '— Choose where it sits —' : '— No valid parent exists yet —'}
                  onChange={(id) => set('parent_id', id)}
                />
                {fieldErrors.parent_id && <div className="field-error">{fieldErrors.parent_id}</div>}
              </div>
            </Step>
          )}

          <Step n={++step} title={`Name the ${typeName}`} hint="The name is what people see everywhere. The code is its short, unique ID.">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="u-name">Name *</label>
                <input id="u-name" value={form.name} onChange={(e) => setName(e.target.value)} required maxLength={255}
                  placeholder={form.unit_type === 'team' ? 'Social Media Marketing' : form.unit_type === 'branch' ? 'Patna office' : 'Digital Marketing'} />
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
                  placeholder="SOCIAL-MEDIA-MARKETING"
                />
                <div className="hint">Filled in from the name. Letters, digits and dashes. Must be unique, and <strong>can’t be changed later</strong>.</div>
                {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
              </div>
            </div>
          </Step>

          {(people || calendars) && (
            <Step n={++step} title="Who runs it, and when does it work?" hint="Both are optional. You can set or change them later.">
              <div className="grid-2">
                {people && (
                  <div className="field">
                    <label htmlFor="u-head">Head (who is responsible)</label>
                    <select id="u-head" value={form.head_user_id} onChange={(e) => set('head_user_id', e.target.value)}>
                      <option value="">— None for now —</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                      ))}
                    </select>
                    <div className="hint">The person who leads this {typeName}. They appear on the chart.</div>
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
                    <div className="hint">Working days, hours and holidays, used for deadlines. Leave it on “Same as…” unless this {typeName} works differently.</div>
                    {calendars.length === 0 && <div className="hint">No calendars yet. <Link to="/calendars">Create one</Link>.</div>}
                    {fieldErrors.calendar_id && <div className="field-error">{fieldErrors.calendar_id}</div>}
                  </div>
                )}
              </div>
            </Step>
          )}

          <div className="row-actions ouc-actions">
            <button className="btn" type="submit" disabled={saving || !form.unit_type || (needsParent && !form.parent_id)}>
              {saving ? 'Creating…' : form.unit_type ? `Create ${typeName}` : 'Create'}
            </button>
            <Link className="btn secondary" to="/org-units">Cancel</Link>
          </div>
        </form>

        <aside className="ouc-preview" aria-label="What you are creating">
          <h3>Preview</h3>
          <ol className="ouc-path">
            <li className="ou-company"><span className="ouc-dot" /> {activeOrg?.name || 'The company'}</li>
            {above.map((u) => (
              <li key={u.id} className={`ou-${u.unit_type}`}><span className="ouc-dot" /> {u.name}</li>
            ))}
            <li className={`ouc-new ${form.unit_type ? `ou-${form.unit_type}` : ''}`}>
              <span className="ouc-dot" /> {form.name.trim() || `New ${typeName}`}
            </li>
          </ol>
          <dl className="ouc-summary">
            <div><dt>Type</dt><dd>{form.unit_type ? UNIT_TYPE_LABELS[form.unit_type] : <span className="muted">Not chosen yet</span>}</dd></div>
            <div><dt>Code</dt><dd className="mono">{form.code || <span className="muted">—</span>}</dd></div>
            {people && <div><dt>Head</dt><dd>{head ? head.name : <span className="muted">None for now</span>}</dd></div>}
            {calendars && <div><dt>Calendar</dt><dd>{calendar ? calendar.name : <span className="muted">Same as the one above</span>}</dd></div>}
          </dl>
          {guide && <p className="ouc-note">{guide.note}</p>}
        </aside>
      </div>
    </div>
  )
}
