import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { calendarsApi } from '@/features/calendars/api.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { organizationsApi } from '@/features/organizations/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import DayRanges from '@/features/calendars/components/DayRanges.jsx'
import { cleanWeek, DAYS, dayError, dayOf, rangesText, summarizeWeek, timezones, usualHours, WEEK_PRESETS } from '@/features/calendars/utils.js'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

// Working calendars: weekly hours, public holidays and extra working days. The organization
// uses one as its calendar, and org units point at one (a new branch starts on the
// organization's, a new sub-unit inherits its parent's when none is chosen).
export default function Calendars() {
  const { user } = useAuth()
  const { orgId, activeOrg, reload: reloadOrgs } = useActiveOrg()
  const canCreate = hasAccess(user, ACCESS.createCalendar)
  const canUpdate = hasAccess(user, ACCESS.updateCalendar)
  // Choosing the organization calendar is an organization setting (client admins).
  const canSetOrgCalendar = hasAccess(user, ACCESS.organizations)

  const calendarsQuery = useLookup(['calendars', orgId], ({ signal }) => calendarsApi.list(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const unitsQuery = useLookup(['org-units', orgId, 'all'], ({ signal }) => orgUnitsApi.listAll(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const calendars = calendarsQuery.data ?? []
  const units = unitsQuery.data ?? [] // empty without org-unit read access
  const loading = calendarsQuery.loading
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' or the id whose holidays are being edited
  const [notice, setNotice] = useState('')

  // After a change: refetch calendars and the units that use them.
  const load = () => {
    setError(null)
    calendarsQuery.reload()
    invalidate(['org-units', orgId])
  }

  const unitsByCalendar = useMemo(() => {
    const map = {}
    for (const u of units) if (u.calendar_id) (map[u.calendar_id] ||= []).push(u)
    return map
  }, [units])

  const saved = (message) => {
    setEditing(null)
    setNotice(message)
    load()
  }

  async function makeOrganizationCalendar(cal) {
    setError(null)
    setNotice('')
    try {
      await organizationsApi.update(orgId, { calendar_id: cal.id })
      reloadOrgs()
      saved(`“${cal.name}” is now the company calendar. Branches, departments and teams that were on the previous one (or on none) use it too.`)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Working calendars</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Working hours, holidays and extra working days for {activeOrg ? `“${activeOrg.name}”` : 'this company'}. The company uses one
            as its calendar and new branches start on it; a new department or team takes the calendar of what it sits
            under unless you pick another.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setEditing(null)} />
          {canCreate && (
            <button className="btn" onClick={() => setEditing('new')} disabled={editing === 'new'}>+ New calendar</button>
          )}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error || calendarsQuery.error} onRetry={error ? undefined : calendarsQuery.reload} />

      {editing === 'new' && (
        <CalendarForm
          orgId={orgId}
          defaultTimezone={activeOrg?.timezone}
          onCancel={() => setEditing(null)}
          onSaved={(c) => saved(`Calendar “${c.name}” created. Add its holidays below, then use it for the company or pick it for a branch, department or team.`)}
        />
      )}

      {loading ? (
        <PanelSkeleton panels={2} lines={3} />
      ) : calendars.length === 0 && editing !== 'new' ? (
        <div className="panel empty-state">
          <h2>No calendars yet</h2>
          <p className="muted">Create one with your office hours, add the year's holidays, then use it as the company calendar.</p>
          {canCreate && <button className="btn" onClick={() => setEditing('new')}>+ New calendar</button>}
        </div>
      ) : (
        calendars.map((cal) => {
          const used = unitsByCalendar[cal.id] || []
          const isOrgCalendar = cal.id === activeOrg?.calendar_id
          return (
            <div key={cal.id} className={`panel role-card${editing === cal.id ? ' editing' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>
                    {cal.name} {isOrgCalendar && <span className="chip subtle">Company calendar</span>}
                  </h2>
                  <p className="muted small" style={{ margin: '2px 0 0' }}>
                    {cal.timezone} · {summarizeWeek(cal.weekly_hours)}
                  </p>
                </div>
                {editing !== cal.id && (
                  <div className="row-actions">
                    {canSetOrgCalendar && !isOrgCalendar && (
                      <button className="btn secondary" onClick={() => makeOrganizationCalendar(cal)}>Use for company</button>
                    )}
                    {canUpdate && <button className="btn secondary" onClick={() => setEditing(cal.id)}>Edit holidays &amp; working days</button>}
                  </div>
                )}
              </div>
              <div className="muted small">
                {used.length === 0
                  ? 'Not used in the company structure yet.'
                  : (
                    <>
                      Used by{' '}
                      {used.slice(0, 5).map((u, i) => (
                        <span key={u.id}>{i > 0 && ', '}<Link to={`/org-units/${u.id}`}>{u.name}</Link></span>
                      ))}
                      {used.length > 5 && ` and ${used.length - 5} more`}.
                    </>
                  )}
              </div>
              {editing === cal.id ? (
                <HolidayEditor
                  orgId={orgId}
                  calendar={cal}
                  onCancel={() => setEditing(null)}
                  onSaved={(c) => saved(`“${c.name}” saved: ${c.holidays.length} holidays, ${c.working_days.length} extra working days.`)}
                />
              ) : (
                <HolidayList holidays={cal.holidays} workingDays={cal.working_days || []} />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const byDate = (a, b) => a.date.localeCompare(b.date)

// Upcoming holidays and extra working days first; past ones collapse into a count.
function HolidayList({ holidays, workingDays }) {
  const today = todayIso()
  if (!holidays.length && !workingDays.length) return <p className="muted small" style={{ marginBottom: 0 }}>No holidays added.</p>
  const upcoming = [...holidays].sort(byDate).filter((h) => h.date >= today)
  const upcomingWork = [...workingDays].sort(byDate).filter((w) => w.date >= today)
  return (
    <div style={{ marginTop: 10 }}>
      <UpcomingChips title="Upcoming holidays" items={upcoming} past={holidays.length - upcoming.length}>
        {(h) => `${formatDate(h.date)} · ${h.name}${h.is_half_day ? ' (half day)' : ''}`}
      </UpcomingChips>
      {workingDays.length > 0 && (
        <UpcomingChips title="Extra working days" items={upcomingWork} past={workingDays.length - upcomingWork.length}>
          {(w) => `${dayOf(w.date).short} ${formatDate(w.date)} · ${w.name} · ${rangesText(w.hours)}`}
        </UpcomingChips>
      )}
    </div>
  )
}

function UpcomingChips({ title, items, past, children: label }) {
  return (
    <>
      <div className="detail-label">{title} ({items.length}){past > 0 && <span className="muted"> · {past} past</span>}</div>
      <div className="chips">
        {items.slice(0, 12).map((item) => (
          <span key={item.date} className="chip subtle">{label(item)}</span>
        ))}
        {items.length > 12 && <span className="muted small">+{items.length - 12} more</span>}
      </div>
    </>
  )
}

function CalendarForm({ orgId, defaultTimezone, onCancel, onSaved }) {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(defaultTimezone || browserTz || 'UTC')
  const [hours, setHours] = useState(() => structuredClone(WEEK_PRESETS[0].hours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const zones = useMemo(() => {
    const list = timezones()
    return list.includes(timezone) ? list : [timezone, ...list]
  }, [timezone])

  const errors = Object.fromEntries(DAYS.map((d) => [d.key, hours[d.key]?.length ? dayError(hours[d.key]) : null]))
  const hasErrors = Object.values(errors).some(Boolean)
  const workingDays = DAYS.filter((d) => hours[d.key]?.length).length

  const setDay = (key, ranges) => setHours((h) => ({ ...h, [key]: ranges }))
  // Copies Monday's hours to the other weekdays (Tue–Fri), the most common shortcut.
  const copyMondayToWeekdays = () =>
    setHours((h) => ({ ...h, ...Object.fromEntries(['tue', 'wed', 'thu', 'fri'].map((k) => [k, (h.mon || []).map((r) => [...r])])) }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(await calendarsApi.create(orgId, { name: name.trim(), timezone, weekly_hours: cleanWeek(hours) }))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel role-card editing" onSubmit={submit}>
      <h2>New calendar</h2>
      <div className="alert info">The name, timezone and hours can't be changed after the calendar is created. Holidays and extra working days can be edited any time.</div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="c-name">Name *</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} placeholder="India office 2026" />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="c-tz">Timezone *</label>
          <select id="c-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} required>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
          {fieldErrors.timezone && <div className="field-error">{fieldErrors.timezone}</div>}
        </div>
      </div>

      <div className="field">
        <label>Working hours *</label>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <span className="muted small">Start from:</span>
          {WEEK_PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn secondary small-btn" onClick={() => setHours(structuredClone(p.hours))}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="week-editor">
          {DAYS.map((d) => {
            const ranges = hours[d.key] || []
            const working = ranges.length > 0
            return (
              <div key={d.key} className={`week-row${working ? '' : ' off'}`}>
                <label className="inline-check week-day">
                  <input type="checkbox" checked={working} onChange={(e) => setDay(d.key, e.target.checked ? [['09:00', '18:00']] : [])} />
                  {d.label}
                </label>
                {working ? (
                  <DayRanges ranges={ranges} onChange={(rs) => setDay(d.key, rs)} label={d.label}>
                    {d.key === 'mon' && (
                      <button type="button" className="link-btn" onClick={copyMondayToWeekdays}>Copy to Tue–Fri</button>
                    )}
                  </DayRanges>
                ) : (
                  <div className="week-ranges"><span className="muted small">Day off</span></div>
                )}
                {errors[d.key] && <div className="field-error week-error">{errors[d.key]}</div>}
              </div>
            )
          })}
        </div>
        <div className="hint">Use two ranges for a break, e.g. 09:30–13:30 and 14:30–18:30. {summarizeWeek(cleanWeek(hours))}</div>
        {fieldErrors.weekly_hours && <div className="field-error">{fieldErrors.weekly_hours}</div>}
      </div>

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || hasErrors || workingDays === 0 || !name.trim()}>
          {saving ? 'Creating…' : 'Create calendar'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

let rowKey = 1
const withKeys = (items, extra = {}) => items.map((x) => ({ ...x, ...extra, key: rowKey++ }))

// Dates that appear more than once in the rows.
function repeatedDates(rows) {
  const seen = new Set()
  const repeated = new Set()
  for (const r of rows) {
    if (!r.date) continue
    if (seen.has(r.date)) repeated.add(r.date)
    seen.add(r.date)
  }
  return repeated
}

// Holidays (days off) and extra working days (days worked with their own hours, usually ones the
// week leaves off, such as a working Saturday). Saving replaces both lists.
function HolidayEditor({ orgId, calendar, onCancel, onSaved }) {
  const [rows, setRows] = useState(() => withKeys([...calendar.holidays].sort(byDate)))
  // `touched`: the hours were set by hand, so picking another date doesn't replace them.
  const [workRows, setWorkRows] = useState(() => withKeys([...(calendar.working_days || [])].sort(byDate), { touched: true }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dupDates = useMemo(() => repeatedDates(rows), [rows])
  const dupWorkDates = useMemo(() => repeatedDates(workRows), [workRows])
  const holidayDates = new Set(rows.map((r) => r.date).filter(Boolean))
  const workDates = new Set(workRows.map((r) => r.date).filter(Boolean))
  const clashes = [...holidayDates].some((d) => workDates.has(d))
  const rangeErrors = Object.fromEntries(workRows.map((r) => [r.key, dayError(r.hours)]))
  const incomplete = [...rows, ...workRows].some((r) => !r.date || !r.name.trim())
  const blocked = incomplete || clashes || dupDates.size > 0 || dupWorkDates.size > 0 || Object.values(rangeErrors).some(Boolean)

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key))
  const add = () => setRows((rs) => [...rs, { key: rowKey++, date: '', name: '', is_half_day: false }])

  const updateWork = (key, patch) => setWorkRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const setWorkDate = (row, date) =>
    updateWork(row.key, row.touched || !date ? { date } : { date, hours: usualHours(calendar.weekly_hours, date) })
  const removeWork = (key) => setWorkRows((rs) => rs.filter((r) => r.key !== key))
  const addWork = () =>
    setWorkRows((rs) => [...rs, { key: rowKey++, date: '', name: '', hours: usualHours(calendar.weekly_hours), touched: false }])

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const holidays = [...rows]
      .sort(byDate)
      .map(({ date, name, is_half_day }) => ({ date, name: name.trim(), is_half_day }))
    const workingDays = [...workRows].sort(byDate).map(({ date, name, hours }) => ({ date, name: name.trim(), hours }))
    try {
      onSaved(await calendarsApi.replaceHolidays(orgId, calendar.id, calendar.version, holidays, workingDays))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      {error && (
        <div className="alert error">
          {friendlyMessage(error)}
          {error.fieldErrors?.length > 0 && (
            <ul style={{ margin: '6px 0 0' }}>
              {error.fieldErrors.map((f, i) => <li key={i}>{f.issue}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="detail-label">Holidays</div>
      <table className="compact holiday-table">
        <thead>
          <tr>
            <th style={{ width: 170 }}>Date</th>
            <th>Name</th>
            <th style={{ width: 110 }}>Half day</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="muted">No holidays. Add the first one below.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <input type="date" value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} required aria-label="Holiday date" />
                {dupDates.has(r.date) && <div className="field-error small">Date listed twice</div>}
                {workDates.has(r.date) && <div className="field-error small">Also an extra working day</div>}
              </td>
              <td>
                <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} required maxLength={255} placeholder="Diwali" aria-label="Holiday name" />
              </td>
              <td>
                <input type="checkbox" checked={r.is_half_day} onChange={(e) => update(r.key, { is_half_day: e.target.checked })} aria-label="Half day" />
              </td>
              <td>
                <button type="button" className="link-btn danger" onClick={() => remove(r.key)} aria-label="Remove holiday">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link-btn" onClick={add} style={{ margin: '8px 0 14px' }}>+ Add holiday</button>

      <div className="detail-label">Extra working days</div>
      <p className="muted small" style={{ margin: '2px 0 8px' }}>
        Days worked with their own hours, such as a working Saturday or a Sunday before a release. Their hours replace
        that weekday's usual ones; time limits that count working hours include them.
      </p>
      <table className="compact holiday-table">
        <thead>
          <tr>
            <th style={{ width: 170 }}>Date</th>
            <th style={{ width: '28%' }}>Reason</th>
            <th>Working hours</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {workRows.length === 0 && (
            <tr><td colSpan={4} className="muted">No extra working days.</td></tr>
          )}
          {workRows.map((r) => {
            const day = r.date ? dayOf(r.date) : null
            const usual = day ? calendar.weekly_hours?.[day.key] : null
            return (
              <tr key={r.key}>
                <td>
                  <input type="date" value={r.date} onChange={(e) => setWorkDate(r, e.target.value)} required aria-label="Working day date" />
                  {day && (
                    <div className="muted small">{day.label}{usual?.length ? `, usually ${rangesText(usual)}` : ', usually a day off'}</div>
                  )}
                  {dupWorkDates.has(r.date) && <div className="field-error small">Date listed twice</div>}
                  {holidayDates.has(r.date) && <div className="field-error small">Also a holiday: keep one of the two</div>}
                </td>
                <td>
                  <input value={r.name} onChange={(e) => updateWork(r.key, { name: e.target.value })} required maxLength={255} placeholder="Diwali make-up day" aria-label="Reason" />
                </td>
                <td>
                  <DayRanges ranges={r.hours} onChange={(hours) => updateWork(r.key, { hours, touched: true })} label="Working day" />
                  {rangeErrors[r.key] && <div className="field-error small">{rangeErrors[r.key]}</div>}
                </td>
                <td>
                  <button type="button" className="link-btn danger" onClick={() => removeWork(r.key)} aria-label="Remove working day">✕</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="link-btn" onClick={addWork} style={{ margin: '8px 0 14px' }}>+ Add working day</button>

      <p className="muted small">Saving replaces this calendar's holidays and extra working days with the rows above.</p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || blocked} aria-busy={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
