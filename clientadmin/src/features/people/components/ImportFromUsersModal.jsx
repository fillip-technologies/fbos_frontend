import { useEffect, useState } from 'react'
import { getImportableUsers, importWorkersFromUsers } from '../api.js'
import { todayISO, toList } from '../utils.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300

const SKIP_REASONS = {
  not_an_active_employee: 'Not an active employee user',
  already_linked: 'Already has an employee record',
  duplicate_in_request: 'Selected twice',
  work_email_taken: 'An employee with this email already exists',
  worker_code_taken: 'Employee code already in use',
}

// Create employee records from existing users: pick users, give each a designation and joining date.
export default function ImportFromUsersModal({ onClose, onImported }) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // user_id -> { designation, date_of_joining } for every ticked user; kept across searches.
  const [selected, setSelected] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  // Names of the users seen so far, so the result can name the ones that were skipped.
  const [names, setNames] = useState({})

  const load = async (cursor = null) => {
    const append = Boolean(cursor)
    try {
      append ? setLoadingMore(true) : setLoading(true)
      setError(null)
      const params = { limit: PAGE_SIZE }
      if (search) params.search = search
      if (cursor) params.cursor = cursor
      const res = await getImportableUsers(params)
      const rows = toList(res)
      setUsers((prev) => (append ? [...prev, ...rows] : rows))
      setNames((prev) => ({ ...prev, ...Object.fromEntries(rows.map((u) => [u.user_id, u.name])) }))
      setNextCursor(res?.page?.has_more ? res.page.next_cursor : null)
    } catch (err) {
      setError(err)
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const toggle = (user) =>
    setSelected((prev) => {
      if (prev[user.user_id]) {
        const { [user.user_id]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [user.user_id]: { designation: '', date_of_joining: todayISO() } }
    })

  const setField = (userId, field, value) =>
    setSelected((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))

  const selectedIds = Object.keys(selected)
  const incomplete = selectedIds.some((id) => !selected[id].designation.trim() || !selected[id].date_of_joining)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const res = await importWorkersFromUsers(
        selectedIds.map((id) => ({
          user_id: id,
          designation: selected[id].designation.trim(),
          date_of_joining: selected[id].date_of_joining,
        })),
      )
      setResult(res)
      onImported()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog title="Add employees from users" onClose={onClose} wide>
      {result ? (
        <div>
          <div className="alert success">
            {result.created.length} employee {result.created.length === 1 ? 'record' : 'records'} created.
          </div>
          {result.skipped.length > 0 && (
            <div className="alert warning">
              <strong>Not created:</strong>
              {result.skipped.map((s) => (
                <div key={s.user_id}>
                  {names[s.user_id] || s.user_id} — {SKIP_REASONS[s.reason] || s.reason}
                </div>
              ))}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="dialog-intro">
            Active employee users who have no employee record yet. Name, email, phone and team come from their user
            account; give each person you pick a designation and a joining date (past dates are fine). The employee code
            can be filled in later.
          </p>

          <ErrorBanner error={error} />

          <div className="toolbar">
            <input
              type="search"
              placeholder="Search by name, email or employee code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          <div className="panel" style={{ padding: 0, maxHeight: '48vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="center-note">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="center-note">No users without an employee record were found.</div>
            ) : (
              users.map((u) => {
                const picked = selected[u.user_id]
                return (
                  <div key={u.user_id} className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '10px 14px' }}>
                    <div className="field check-field" style={{ margin: 0 }}>
                      <label htmlFor={`pick-${u.user_id}`}>
                        <input
                          id={`pick-${u.user_id}`}
                          type="checkbox"
                          checked={Boolean(picked)}
                          onChange={() => toggle(u)}
                        />
                        <span>
                          <strong>{u.name}</strong>
                          <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
                            {u.email}
                            {u.employee_code ? ` · ${u.employee_code}` : ''}
                          </span>
                        </span>
                      </label>
                    </div>
                    {picked && (
                      <div className="grid-2" style={{ marginTop: 10 }}>
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label htmlFor={`desig-${u.user_id}`}>Designation<span className="req">*</span></label>
                          <input
                            id={`desig-${u.user_id}`}
                            type="text"
                            value={picked.designation}
                            onChange={(e) => setField(u.user_id, 'designation', e.target.value)}
                            placeholder="e.g. Accountant"
                          />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label htmlFor={`join-${u.user_id}`}>Date of joining<span className="req">*</span></label>
                          <input
                            id={`join-${u.user_id}`}
                            type="date"
                            value={picked.date_of_joining}
                            onChange={(e) => setField(u.user_id, 'date_of_joining', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {nextCursor && (
            <div className="row-actions" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button type="button" className="btn secondary" onClick={() => load(nextCursor)} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

          <div className="dialog-actions">
            <span className="muted small spacer" style={{ alignSelf: 'center' }}>
              {selectedIds.length} selected
            </span>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn" disabled={saving || selectedIds.length === 0 || incomplete}>
              {saving ? 'Creating...' : 'Create employee records'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
