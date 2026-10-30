import { useState, useEffect } from 'react'
import { getSeparations, updateClearance, calculateSettlement, finalizeExit } from '../api.js'
import { formatCurrency, formatDate, toList } from '../utils.js'

export default function SeparationManager() {
  const [separations, setSeparations] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getSeparations()
      setSeparations(toList(res))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateDeptClearance = async (sepId, dept, status) => {
    try {
      await updateClearance(sepId, {
        department: dept,
        status: status,
        remarks: `Manually marked ${status} in clearance portal`,
      })
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  const handleCalculateFnF = async (sepId) => {
    try {
      await calculateSettlement(sepId)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  const handleFinalize = async (sepId) => {
    if (!confirm('Are you sure you want to finalize this exit? This will deactivate identity login, release position seat, and queue relieving certificate generation.')) return
    try {
      await finalizeExit(sepId)
      loadData()
    } catch (err) {
      alert(err?.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Offboarding & Full-and-Final Hub</h1>
          <p className="text-sm text-zinc-400">Exit workflow, cross-departmental clearance matrix, and automated F&F settlement</p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading offboarding cases...</div>
        ) : separations.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
            No active separation cases.
          </div>
        ) : (
          separations.map((sep) => (
            <div key={sep.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-emerald-400">{sep.separation_code}</span>
                    <span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                      {sep.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Resigned: {formatDate(sep.resignation_date)} • Agreed LWD: {formatDate(sep.agreed_lwd)} • Shortfall: {sep.notice_shortfall_days} days
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sep.status === 'clearance_completed' && (
                    <button
                      onClick={() => handleCalculateFnF(sep.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      Calculate F&F Settlement
                    </button>
                  )}
                  {sep.status === 'settled' && (
                    <button
                      onClick={() => handleFinalize(sep.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      Finalize Exit & Lock Account
                    </button>
                  )}
                </div>
              </div>

              {/* Clearance Matrix Checklist */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-zinc-400 tracking-wider mb-3">
                  Department Clearance Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {(sep.clearances || []).map((cl) => (
                    <div key={cl.id} className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-200 capitalize">
                          {cl.department.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            cl.status === 'cleared'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : cl.status === 'blocked'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {cl.status}
                        </span>
                      </div>
                      {cl.remarks && <p className="text-[11px] text-zinc-500 truncate">{cl.remarks}</p>}
                      {sep.status === 'clearance_pending' && cl.status !== 'cleared' && (
                        <div className="flex gap-1 pt-1">
                          <button
                            onClick={() => handleUpdateDeptClearance(sep.id, cl.department, 'cleared')}
                            className="flex-1 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 rounded text-[10px] font-medium"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => handleUpdateDeptClearance(sep.id, cl.department, 'blocked')}
                            className="flex-1 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded text-[10px]"
                          >
                            Block
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* F&F Settlement Breakdown */}
              {sep.settlement && (
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <div className="text-xs font-semibold uppercase text-zinc-300 tracking-wider">
                    Full & Final Settlement Breakdown
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Encashable Leaves</span>
                      <span className="text-zinc-200 font-semibold">{sep.settlement.encashable_leave_days} days ({formatCurrency(sep.settlement.encashable_leaves_amount)})</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Notice Shortfall Deduction</span>
                      <span className="text-rose-400 font-semibold">-{formatCurrency(sep.settlement.notice_shortfall_deduction)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Net Settlement Amount</span>
                      <span className="text-base font-bold text-emerald-400">{formatCurrency(sep.settlement.net_payable, sep.settlement.currency)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Settlement Status</span>
                      <span className="text-xs uppercase font-bold text-zinc-300">{sep.settlement.status}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
