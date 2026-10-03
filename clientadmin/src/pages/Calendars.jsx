import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { calendarsApi, orgUnitsApi } from '../api/client.js'
import { friendlyMessage, getFieldErrors } from '../api/errors.js'
import { ACCESS, hasAccess } from '../auth/access.js'
import { useActiveOrg } from '../auth/ActiveOrg.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import OrgSwitcher from '../components/OrgSwitcher.jsx'
import { cleanWeek, DAYS, dayError, summarizeWeek, timezones, WEEK_PRESETS } from '../utils/calendars.js'
import { todayIso } from '../utils/dates.js'
import { formatDate } from '../utils/format.js'

// Working calendars: weekly hours and public holidays. Org units point at one (a new
// sub-unit inherits its parent's when none is chosen).
export default function Calendars() {
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canCreate = hasAccess(user, ACCESS.createCalendar)
  const canUpdate = hasAccess(user, ACCESS.updateCalendar)

  const [calendars, setCalendars] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' or the id whose holidays are being edited
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    Promise.all([calendarsApi.list(orgId), orgUnitsApi.listAll(orgId).catch(() => [])])
      .then(([cals, u]) => {
        setCalendars(cals)
        setUnits(u)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId])
  useEffect(load, [load])

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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Working calendars</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Working hours and holidays for {activeOrg ? `“${activeOrg.name}”` : 'this organization'}. Each org unit can use
            one; a new sub-unit takes its parent's calendar unless you pick another.
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
      <ErrorBanner error={error} onRetry={load} />

      {editing === 'new' && (
        <CalendarForm
          orgId={orgId}
          defaultTimezone={activeOrg?.timezone}
          onCancel={() => setEditing(null)}
          onSaved={(c) => saved(`Calendar “${c.name}” created. Add its holidays below, then pick it on your org units.`)}
        />
      )}

      {loading ? (
        <div className="center-note">Loading…</div>
      ) : calendars.length === 0 && editing !== 'new' ? (
        <div className="panel empty-state">
          <h2>No calendars yet</h2>
          <p className="muted">Create one with your office hours, add the year's holidays, then assign it to your company unit.</p>
          {canCreate && <button className="btn" onClick={() => setEditing('new')}>+ New calendar</button>}
        </div>
      ) : (
        calendars.map((cal) => {
          const used = unitsByCalendar[cal.id] || []
          return (
            <div key={cal.id} className={`panel role-card${editing === cal.id ? ' editing' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{cal.name}</h2>
                  <p className="muted small" style={{ margin: '2px 0 0' }}>
                    {cal.timezone} · {summarizeWeek(cal.weekly_hours)}
                  </p>
                </div>
                {canUpdate && editing !== cal.id && (
                  <button className="btn secondary" onClick={() => setEditing(cal.id)}>Edit holidays</button>
                )}
              </div>
              <div className="muted small">
                {used.length === 0
                  ? 'Not used by any org unit yet.'
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
                  onSaved={(c) => saved(`Holidays for “${c.name}” saved (${c.holidays.length}).`)}
                />
              ) : (
                <HolidayList holidays={cal.holidays} />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// Upcoming holidays first; past ones of the current list collapse into a count.
function HolidayList({ holidays }) {
  const today = todayIso()
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = sorted.filter((h) => h.date >= today)
  const past = sorted.length - upcoming.length
  if (!sorted.length) return <p className="muted small" style={{ marginBottom: 0 }}>No holidays added.</p>
  return (
    <div style={{ marginTop: 10 }}>
      <div className="detail-label">Upcoming holidays ({upcoming.length}){past > 0 && <span className="muted"> · {past} past</span>}</div>
      <div className="chips">
        {upcoming.slice(0, 12).map((h) => (
          <span key={h.date} className="chip subtle">
            {formatDate(h.date)} · {h.name}{h.is_half_day ? ' (half day)' : ''}
          </span>
        ))}
        {upcoming.length > 12 && <span className="muted small">+{upcoming.length - 12} more</span>}
      </div>
    </div>
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
  const setRange = (key, i, pos, value) =>
    setDay(key, hours[key].map((r, j) => (j === i ? (pos === 0 ? [value, r[1]] : [r[0], value]) : r)))
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
      <div className="alert info">The name, timezone and hours can't be changed after the calendar is created. Holidays can be edited any time.</div>
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
                <div className="week-ranges">
                  {!working && <span className="muted small">Day off</span>}
                  {ranges.map((r, i) => (
                    <span key={i} className="week-range">
                      <input type="time" value={r[0]} onChange={(e) => setRange(d.key, i, 0, e.target.value)} aria-label={`${d.label} start`} required />
                      <span className="muted">–</span>
                      <input type="time" value={r[1]} onChange={(e) => setRange(d.key, i, 1, e.target.value)} aria-label={`${d.label} end`} required />
                      {ranges.length > 1 && (
                        <button type="button" className="link-btn danger" onClick={() => setDay(d.key, ranges.filter((_, j) => j !== i))} aria-label="Remove time range">✕</button>
                      )}
                    </span>
                  ))}
                  {working && (
                    <button type="button" className="link-btn" onClick={() => setDay(d.key, [...ranges, [ranges[ranges.length - 1][1], '18:00']])}>
                      + Add range
                    </button>
                  )}
                  {d.key === 'mon' && working && (
                    <button type="button" className="link-btn" onClick={copyMondayToWeekdays}>Copy to Tue–Fri</button>
                  )}
                </div>
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

function HolidayEditor({ orgId, calendar, onCancel, onSaved }) {
  const [rows, setRows] = useState(() =>
    [...calendar.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => ({ ...h, key: rowKey++ }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dupDates = useMemo(() => {
    const seen = new Set()
    const dups = new Set()
    for (const r of rows) {
      if (!r.date) continue
      if (seen.has(r.date)) dups.add(r.date)
      seen.add(r.date)
    }
    return dups
  }, [rows])
  const incomplete = rows.some((r) => !r.date || !r.name.trim())

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key))
  const add = () => setRows((rs) => [...rs, { key: rowKey++, date: '', name: '', is_half_day: false }])

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const holidays = [...rows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, name, is_half_day }) => ({ date, name: name.trim(), is_half_day }))
    try {
      onSaved(await calendarsApi.replaceHolidays(orgId, calendar.id, calendar.version, holidays))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      {error && <div className="alert error">{friendlyMessage(error)}</div>}
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
      <p className="muted small">Saving replaces this calendar's whole holiday list with the rows above.</p>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || incomplete || dupDates.size > 0}>
          {saving ? 'Saving…' : `Save holidays (${rows.length})`}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
