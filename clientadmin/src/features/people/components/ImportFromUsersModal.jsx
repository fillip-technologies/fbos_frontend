import { useEffect, useState } from 'react'
import { getImportableUsers, importWorkersFromUsers } from '../api.js'
import { toList } from '../utils.js'

const PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300

const SKIP_REASONS = {
  not_an_active_employee: 'Not an active employee user',
  already_linked: 'Already has an employee record',
  duplicate_in_request: 'Selected twice',
  work_email_taken: 'An employee with this email already exists',
  worker_code_taken: 'Employee code already in use',
}

const today = () => new Date().toISOString().split('T')[0]

function errorMessage(err) {
  return err?.response?.data?.detail?.message || err?.response?.data?.message || err.message
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

  const load = async (cursor = null) => {
    const append = Boolean(cursor)
    try {
      append ? setLoadingMore(true) : setLoading(true)
      const params = { limit: PAGE_SIZE }
      if (search) params.search = search
      if (cursor) params.cursor = cursor
      const res = await getImportableUsers(params)
      setUsers((prev) => (append ? [...prev, ...toList(res)] : toList(res)))
      setNextCursor(res?.page?.has_more ? res.page.next_cursor : null)
    } catch (err) {
      setError(errorMessage(err))
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
      return { ...prev, [user.user_id]: { designation: '', date_of_joining: today() } }
    })

  const setField = (userId, field, value) =>
    setSelected((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))

  const selectedIds = Object.keys(selected)
  const incomplete = selectedIds.some((id) => !selected[id].designation.trim() || !selected[id].date_of_joining)

  const handleSubmit = async () => {
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
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const nameOf = (userId) => users.find((u) => u.user_id === userId)?.name || userId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-lg font-medium text-zinc-100">Add employees from users</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-200">
              {result.created.length} employee {result.created.length === 1 ? 'record' : 'records'} created.
            </p>
            {result.skipped.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300 space-y-1">
                <p className="font-medium">Not created:</p>
                {result.skipped.map((s) => (
                  <p key={s.user_id}>
                    {nameOf(s.user_id)} — {SKIP_REASONS[s.reason] || s.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-400">
              Active employee users who have no employee record yet. Name, email, phone and team come from their user
              account; add a designation and joining date (back-dating is fine) for each person you pick. The employee
              code can be filled in later.
            </p>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <input
              type="text"
              placeholder="Search by name, email or employee code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />

            <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800/60">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  No users without an employee record were found.
                </p>
              ) : (
                users.map((u) => {
                  const picked = selected[u.user_id]
                  return (
                    <div key={u.user_id} className="px-4 py-3 space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(picked)}
                          onChange={() => toggle(u)}
                          className="accent-emerald-500"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-zinc-200">{u.name}</span>
                          <span className="block text-xs text-zinc-500 truncate">
                            {u.email}
                            {u.employee_code ? ` · ${u.employee_code}` : ''}
                          </span>
                        </span>
                      </label>
                      {picked && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                          <input
                            type="text"
                            placeholder="Designation *"
                            value={picked.designation}
                            onChange={(e) => setField(u.user_id, 'designation', e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            type="date"
                            aria-label="Date of joining"
                            value={picked.date_of_joining}
                            onChange={(e) => setField(u.user_id, 'date_of_joining', e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {nextCursor && (
              <div className="flex justify-center">
                <button
                  onClick={() => load(nextCursor)}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-400">{selectedIds.length} selected</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || selectedIds.length === 0 || incomplete}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create employee records'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
