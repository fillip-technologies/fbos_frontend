import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getWorkers, createWorker } from '../api.js'
import { WORKER_STATUS_BADGES, formatDate, toList } from '../utils.js'
import ImportFromUsersModal from '../components/ImportFromUsersModal.jsx'

const PAGE_SIZE = 50

export default function EmployeeDirectory() {
  const [workers, setWorkers] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    work_email: '',
    phone: '',
    designation: '',
    employment_type: 'full_time',
    status: 'active',
    date_of_joining: new Date().toISOString().split('T')[0],
    custom_worker_code: '',
    bank_name: '',
    bank_account_no: '',
    ifsc_code: '',
    tax_id: '',
  })

  const loadData = async (cursor = null) => {
    const append = Boolean(cursor)
    try {
      append ? setLoadingMore(true) : setLoading(true)
      const params = { limit: PAGE_SIZE }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (cursor) params.cursor = cursor
      const res = await getWorkers(params)
      setWorkers((prev) => (append ? [...prev, ...toList(res)] : toList(res)))
      setNextCursor(res?.page?.has_more ? res.page.next_cursor : null)
    } catch (err) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [search, statusFilter])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createWorker(form)
      setModalOpen(false)
      setForm({
        first_name: '',
        last_name: '',
        work_email: '',
        phone: '',
        designation: '',
        employment_type: 'full_time',
        status: 'active',
        date_of_joining: new Date().toISOString().split('T')[0],
        custom_worker_code: '',
        bank_name: '',
        bank_account_no: '',
        ifsc_code: '',
        tax_id: '',
      })
      loadData()
    } catch (err) {
      setError(err?.response?.data?.detail?.message || err?.response?.data?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Employee Directory</h1>
          <p className="text-sm text-zinc-400">360° Workforce Directory with Position Architecture</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-lg text-sm font-medium transition"
          >
            Add from users
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
          >
            Add Employee
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by name, email, or employee code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="on_leave">On Leave</option>
          <option value="noticed">Noticed</option>
          <option value="exited">Exited</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Joining Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-zinc-500">
                  Loading workforce records...
                </td>
              </tr>
            ) : workers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-zinc-500">
                  No employee records found.
                </td>
              </tr>
            ) : (
              workers.map((w) => (
                <tr key={w.id} className="hover:bg-zinc-800/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {w.worker_code || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{w.name || `${w.first_name} ${w.last_name}`}</div>
                    <div className="text-xs text-zinc-500">{w.work_email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{w.designation}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(w.date_of_joining)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                        WORKER_STATUS_BADGES[w.status] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/people/employees/${w.id}`}
                      className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                    >
                      360° Profile →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={() => loadData(nextCursor)}
            disabled={loadingMore}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {importOpen && (
        <ImportFromUsersModal onClose={() => setImportOpen(false)} onImported={() => loadData()} />
      )}

      {/* Add Employee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-medium text-zinc-100">Add Employee Record</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Supports adding existing workforce directly with historical back-dated joining dates and custom employee codes.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={form.work_email}
                    onChange={(e) => setForm({ ...form, work_email: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Date of Joining (Back-dating supported) *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date_of_joining}
                    onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Custom Employee Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.custom_worker_code}
                    onChange={(e) => setForm({ ...form, custom_worker_code: e.target.value })}
                    placeholder="e.g. EMP-2020-0042"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Employment Type</label>
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contractor">Contractor</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
