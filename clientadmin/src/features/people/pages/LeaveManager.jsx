import { useState, useEffect } from 'react'
import { getLeavePlans, createLeavePlan, getLeaveRequests, approveLeaveRequest } from '../api.js'
import { formatDate } from '../utils.js'

export default function LeaveManager() {
  const [plans, setPlans] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    annual_quota: 12.0,
    accrual_frequency: 'annual',
    carryforward_max: 5.0,
    is_encashable: false,
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const pRes = await getLeavePlans()
      setPlans(pRes.data || [])
      const rRes = await getLeaveRequests()
      setRequests(rRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    try {
      await createLeavePlan(form)
      setModalOpen(false)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  const handleApprove = async (id, approved) => {
    try {
      await approveLeaveRequest(id, approved)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Leaves & Time Off Hub</h1>
          <p className="text-sm text-zinc-400">Leave Plans, double-entry accrual balance ledger, and manager approvals</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          Create Leave Plan
        </button>
      </div>

      {/* Plans List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-zinc-300 tracking-wider">Leave Policy Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-400">{p.code}</span>
                {p.is_encashable && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Encashable
                  </span>
                )}
              </div>
              <div className="text-base font-semibold text-zinc-100">{p.name}</div>
              <div className="text-xs text-zinc-400">
                Annual Quota: <span className="font-semibold text-zinc-200">{p.annual_quota} days</span>
              </div>
              <div className="text-xs text-zinc-500">
                Max Carryforward: {p.carryforward_max} days ({p.accrual_frequency})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-zinc-300 tracking-wider">Pending Leave Applications</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Worker ID</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                    Loading leave requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.worker_id}</td>
                    <td className="px-4 py-3">{formatDate(r.start_date)}</td>
                    <td className="px-4 py-3">{formatDate(r.end_date)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">{r.days_count}</td>
                    <td className="px-4 py-3 text-xs">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id, true)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprove(r.id, false)}
                            className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 rounded text-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Create Leave Plan</h3>
            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Plan Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SICK_LEAVE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sick & Medical Leave"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Annual Quota (Days)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={form.annual_quota}
                    onChange={(e) => setForm({ ...form, annual_quota: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Max Carryforward</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={form.carryforward_max}
                    onChange={(e) => setForm({ ...form, carryforward_max: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_encashable"
                  checked={form.is_encashable}
                  onChange={(e) => setForm({ ...form, is_encashable: e.target.checked })}
                  className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                />
                <label htmlFor="is_encashable" className="text-xs text-zinc-300">
                  Allow Encashment on Exit (F&F)
                </label>
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
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
