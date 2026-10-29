import { useState, useEffect } from 'react'
import { getRequisitions, createRequisition, getPositions } from '../api.js'
import { REQUISITION_STATUS_BADGES, formatDate } from '../utils.js'

export default function RecruitmentJobs() {
  const [requisitions, setRequisitions] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    department: 'Engineering',
    position_id: '',
    openings_count: 1,
    employment_type: 'full_time',
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getRequisitions()
      setRequisitions(res.data || [])
      const posRes = await getPositions()
      setPositions(posRes.data?.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createRequisition({
        ...form,
        position_id: form.position_id || null,
      })
      setModalOpen(false)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Talent Acquisition & ATS</h1>
          <p className="text-sm text-zinc-400">Job Requisitions, Position Budgets, and Candidate Pipeline</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          Open Requisition
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Job Title</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Openings</th>
              <th className="px-4 py-3">Filled</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                  Loading requisitions...
                </td>
              </tr>
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                  No active job requisitions found.
                </td>
              </tr>
            ) : (
              requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-zinc-800/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{req.requisition_code}</td>
                  <td className="px-4 py-3 font-medium text-zinc-200">{req.title}</td>
                  <td className="px-4 py-3 text-zinc-400">{req.department || '-'}</td>
                  <td className="px-4 py-3">{req.openings_count}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">{req.filled_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                        REQUISITION_STATUS_BADGES[req.status] || 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(req.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Create Job Requisition</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Requisition Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Link to Position Seat (Optional)</label>
                <select
                  value={form.position_id}
                  onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">No position seat (Draft)</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.position_code} - {p.title} ({p.hiring_status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Openings Count</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.openings_count}
                  onChange={(e) => setForm({ ...form, openings_count: parseInt(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium"
                >
                  Publish Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
