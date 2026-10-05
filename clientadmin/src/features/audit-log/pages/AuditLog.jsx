import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { auditLogApi } from '@/features/audit-log/api.js'
import { actionLabel, detailNote, STATUS_BADGES, STATUS_LABELS, VIEWS } from '@/features/audit-log/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { describeDevice } from '@/features/sessions/utils.js'
import { usersApi } from '@/features/users/api.js'
import { formatDateTime } from '@/features/users/utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const NO_FILTERS = { view: 'activity', user_id: '', from: '', to: '' }

// Start of a local calendar day (YYYY-MM-DD), plus `addDays`, as a UTC instant.
function dayStart(isoDate, addDays = 0) {
  if (!isoDate) return undefined
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

// The security log: sign-ins, failed attempts, sign-outs and locks, newest first.
export default function AuditLog() {
  const [params] = useSearchParams()
  const { orgId, activeOrg } = useActiveOrg()

  const [filters, setFilters] = useState({ ...NO_FILTERS, user_id: params.get('user') || '' })
  const [people, setPeople] = useState([]) // for the person filter; empty without user read access
  const [entries, setEntries] = useState([])
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) return
    usersApi
      .list(orgId, { limit: 100 })
      .then((res) => setPeople(res.data))
      .catch(() => setPeople([]))
  }, [orgId])

  const load = useCallback(() => {
    if (!orgId) return
    const view = VIEWS.find((v) => v.value === filters.view) || VIEWS[0]
    setLoading(true)
    setError(null)
    auditLogApi
      .list(orgId, {
        limit: 25,
        cursor,
        ...view.params,
        user_id: filters.user_id || undefined,
        created_after: dayStart(filters.from),
        created_before: dayStart(filters.to, 1), // the "to" day is included
      })
      .then((res) => {
        setEntries(res.data)
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, cursor, filters])
  useEffect(load, [load])

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (key, value) => {
    resetPaging()
    setFilters((f) => ({ ...f, [key]: value }))
  }

  // People offered in the filter: everyone listed, plus whoever is picked from a row.
  const personOptions = useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p.name]))
    for (const e of entries) if (e.user && !byId.has(e.user.id)) byId.set(e.user.id, e.user.name)
    if (filters.user_id && !byId.has(filters.user_id)) byId.set(filters.user_id, 'Selected person')
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [people, entries, filters.user_id])

  const filtered = filters.view !== NO_FILTERS.view || filters.user_id || filters.from || filters.to

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Security log</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Sign-ins, failed attempts, sign-outs and locked accounts in {activeOrg ? `“${activeOrg.name}”` : 'this company'},
            newest first. Times are in your local time.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher
            onChange={() => {
              resetPaging()
              setFilters((f) => ({ ...f, user_id: '' }))
            }}
          />
        </div>
      </div>

      <div className="toolbar">
        <select value={filters.view} onChange={(e) => setFilter('view', e.target.value)}>
          {VIEWS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
        {personOptions.length > 0 && (
          <select value={filters.user_id} onChange={(e) => setFilter('user_id', e.target.value)}>
            <option value="">Everyone</option>
            {personOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <label className="inline-check">
          From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="inline-check">
          To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        {filtered && (
          <button
            className="link-btn"
            onClick={() => {
              resetPaging()
              setFilters(NO_FILTERS)
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <ErrorBanner error={error} onRetry={load} />

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="compact">
          <thead>
            <tr>
              <th>When</th>
              <th>What happened</th>
              <th>Who</th>
              <th>Result</th>
              <th>From</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="center-note">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="center-note">Nothing recorded for these filters.</td></tr>
            ) : (
              entries.map((e) => {
                const note = detailNote(e.details)
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.created_at)}</td>
                    <td>
                      {actionLabel(e.action)}
                      {note && <div className="muted small">{note}</div>}
                    </td>
                    <td>
                      {e.user ? (
                        <>
                          <button className="link-btn" title="Show only this person" onClick={() => setFilter('user_id', e.user.id)}>
                            {e.user.name}
                          </button>
                          <div className="muted small">{e.user.email}</div>
                        </>
                      ) : (
                        <span className="muted">{e.details?.email || 'Unknown'}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGES[e.status] || 'inactive'}`}>{STATUS_LABELS[e.status] || e.status}</span>
                    </td>
                    <td title={e.user_agent || undefined}>
                      <span className="mono">{e.ip_address || '—'}</span>
                      <div className="muted small">{describeDevice(e.user_agent)}</div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          className="btn secondary"
          disabled={loading || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Newer
        </button>
        <button
          className="btn secondary"
          disabled={loading || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Older →
        </button>
      </div>
    </div>
  )
}
