import { useState, useEffect } from 'react'
import { getPayrollRuns, createPayrollRun, disbursePayrollRun, getReimbursements, approveReimbursement } from '../api.js'
import { formatCurrency, formatDate, toList } from '../utils.js'

export default function PayrollHub() {
  const [runs, setRuns] = useState([])
  const [reimbursements, setReimbursements] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const rRes = await getPayrollRuns()
      setRuns(toList(rRes))
      const eRes = await getReimbursements()
      setReimbursements(toList(eRes))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateRun = async (e) => {
    e.preventDefault()
    try {
      await createPayrollRun(form)
      setModalOpen(false)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err?.response?.data?.message || err.message)
    }
  }

  const handleDisburse = async (id) => {
    if (!confirm('Are you sure you want to disburse this payroll run? This will finalize payslips and queue settlement outbox events.')) return
    try {
      await disbursePayrollRun(id)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  const handleApproveClaim = async (id, approved) => {
    try {
      await approveReimbursement(id, approved)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Payroll & Expense Hub</h1>
          <p className="text-sm text-zinc-400">Monthly compensation pay runs, itemized payslips, and reimbursement claims</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
        >
          Execute Monthly Pay Run
        </button>
      </div>

      {/* Payroll Runs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-zinc-300 tracking-wider">Payroll Runs History</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Headcount</th>
                <th className="px-4 py-3">Total Gross</th>
                <th className="px-4 py-3">Total Deductions</th>
                <th className="px-4 py-3">Net Disbursed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-zinc-500">
                    Loading payroll history...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-zinc-500">
                    No payroll runs executed yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">{r.payroll_code}</td>
                    <td className="px-4 py-3 font-medium text-zinc-200">{r.year}-{String(r.month).padStart(2, '0')}</td>
                    <td className="px-4 py-3">{r.total_workers} workers</td>
                    <td className="px-4 py-3">{formatCurrency(r.total_gross)}</td>
                    <td className="px-4 py-3 text-rose-400">-{formatCurrency(r.total_deductions)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">{formatCurrency(r.total_net)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'calculated' && (
                        <button
                          onClick={() => handleDisburse(r.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                        >
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reimbursement Claims */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-zinc-300 tracking-wider">Employee Expense Claims</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-800/60 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Claim Code</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {reimbursements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                    No expense claims submitted.
                  </td>
                </tr>
              ) : (
                reimbursements.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{c.claim_code}</td>
                    <td className="px-4 py-3 capitalize">{c.category}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-200">{formatCurrency(c.amount, c.currency)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(c.spent_date)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{c.description}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {c.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => handleApproveClaim(c.id, true)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproveClaim(c.id, false)}
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Execute Monthly Pay Run</h3>
            <form onSubmit={handleCreateRun} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Year</label>
                <input
                  type="number"
                  required
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Month (1 - 12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
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
                  Calculate Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
