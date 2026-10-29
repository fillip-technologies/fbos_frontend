import { useState, useEffect } from 'react'
import { getAttendance, recordAttendance, getWorkers } from '../api.js'
import { ATTENDANCE_STATUS_BADGES, formatDateTime } from '../utils.js'

export default function AttendanceBoard() {
  const [records, setRecords] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    worker_id: '',
    work_date: new Date().toISOString().split('T')[0],
    clock_in_time: '',
    clock_out_time: '',
    status: 'present',
    notes: '',
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getAttendance()
      setRecords(res.data || [])
      const wRes = await getWorkers()
      setWorkers(wRes.data?.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRecord = async (e) => {
    e.preventDefault()
    try {
      await recordAttendance({
        ...form,
        clock_in_time: form.clock_in_time ? `${form.work_date}T${form.clock_in_time}:00Z` : null,
        clock_out_time: form.clock_out_time ? `${form.work_date}T${form.clock_out_time}:00Z` : null,
      })
      setModalOpen(false)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err?.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Time & Attendance Board</h1>
          <p className="text-sm text-zinc-400">Shift schedules, enterprise overtime gates, and attendance regularization</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          Add Historical / Manual Attendance
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3">Work Date</th>
              <th className="px-4 py-3">Worker ID</th>
              <th className="px-4 py-3">Clock In</th>
              <th className="px-4 py-3">Clock Out</th>
              <th className="px-4 py-3">Working Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                  Loading attendance records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/30 transition">
                  <td className="px-4 py-3 font-mono text-xs">{r.work_date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.worker_id}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(r.clock_in_time)}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(r.clock_out_time)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.working_minutes > 0 ? `${Math.floor(r.working_minutes / 60)}h ${r.working_minutes % 60}m` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                        ATTENDANCE_STATUS_BADGES[r.status] || 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{r.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual / Historical Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Direct Attendance Entry</h3>
            <p className="text-xs text-zinc-400">
              Supports historical back-dating for past attendance imports.
            </p>
            <form onSubmit={handleRecord} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Worker *</label>
                <select
                  required
                  value={form.worker_id}
                  onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Select Employee</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.worker_code} - {w.first_name} {w.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Work Date *</label>
                <input
                  type="date"
                  required
                  value={form.work_date}
                  onChange={(e) => setForm({ ...form, work_date: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Clock In Time</label>
                  <input
                    type="time"
                    value={form.clock_in_time}
                    onChange={(e) => setForm({ ...form, clock_in_time: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Clock Out Time</label>
                  <input
                    type="time"
                    value={form.clock_out_time}
                    onChange={(e) => setForm({ ...form, clock_out_time: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="present">Present</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                  <option value="holiday">Holiday</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Biometric sync"
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
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
