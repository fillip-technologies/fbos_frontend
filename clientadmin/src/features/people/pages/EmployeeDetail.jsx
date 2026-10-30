import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getWorker,
  getWorkerBalances,
  adjustLeaveBalance,
  getSalaryStructure,
  createSalaryStructure,
  getCompensationRevisions,
  createCompensationRevision,
  getPromotions,
  createPromotion,
  getBonuses,
  awardBonus,
  initiateSeparation,
  getSeparations,
  getAttendance,
  clockIn,
  clockOut,
} from '../api.js'
import {
  WORKER_STATUS_BADGES,
  ATTENDANCE_STATUS_BADGES,
  formatCurrency,
  formatDate,
  formatDateTime,
  toItem,
  toList,
} from '../utils.js'

export default function EmployeeDetail() {
  const { id } = useParams()
  const [worker, setWorker] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Sub-resource states
  const [balances, setBalances] = useState([])
  const [salaryStruct, setSalaryStruct] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [promotions, setPromotions] = useState([])
  const [bonuses, setBonuses] = useState([])
  const [separations, setSeparations] = useState([])
  const [attendance, setAttendance] = useState([])

  // Modal states
  const [hikeModal, setHikeModal] = useState(false)
  const [hikeForm, setHikeForm] = useState({
    revision_type: 'annual_hike',
    increment_pct: 10.0,
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [bonusModal, setBonusModal] = useState(false)
  const [bonusForm, setBonusForm] = useState({
    bonus_type: 'spot_award',
    amount: 1000.0,
    payout_month: new Date().toISOString().slice(0, 7),
    reason: '',
  })

  const [leaveModal, setLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    leave_plan_id: '',
    transaction_type: 'opening_balance',
    units_days: 10.0,
    effective_date: new Date().toISOString().split('T')[0],
    description: 'Manual balance adjustment',
  })

  const [sepModal, setSepModal] = useState(false)
  const [sepForm, setSepForm] = useState({
    separation_type: 'resignation',
    resignation_date: new Date().toISOString().split('T')[0],
    contractual_lwd: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    agreed_lwd: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notice_shortfall_days: 0,
    reason: '',
  })

  const loadWorker = async () => {
    try {
      setLoading(true)
      const res = await getWorker(id)
      setWorker(toItem(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async () => {
    if (!id) return
    try {
      if (activeTab === 'leaves') {
        const balRes = await getWorkerBalances(id)
        setBalances(toList(balRes))
      } else if (activeTab === 'compensation') {
        const structRes = await getSalaryStructure(id)
        setSalaryStruct(toItem(structRes))
        const revRes = await getCompensationRevisions(id)
        setRevisions(toList(revRes))
        const promoRes = await getPromotions(id)
        setPromotions(toList(promoRes))
        const bonRes = await getBonuses(id)
        setBonuses(toList(bonRes))
      } else if (activeTab === 'separation') {
        const sepRes = await getSeparations({ worker_id: id })
        setSeparations(toList(sepRes))
      } else if (activeTab === 'attendance') {
        const attRes = await getAttendance({ worker_id: id })
        setAttendance(toList(attRes))
      }
    } catch (err) {
      console.error('Error loading tab data', err)
    }
  }

  useEffect(() => {
    loadWorker()
  }, [id])

  useEffect(() => {
    loadTabData()
  }, [id, activeTab])

  const handleRecordHike = async (e) => {
    e.preventDefault()
    if (!salaryStruct?.annual_ctc) {
      alert('This employee has no active salary structure, so a revision cannot be recorded yet.')
      return
    }
    try {
      await createCompensationRevision(id, {
        ...hikeForm,
        previous_annual_ctc: salaryStruct.annual_ctc,
      })
      setHikeModal(false)
      loadTabData()
      loadWorker()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err.message)
    }
  }

  const handleAwardBonus = async (e) => {
    e.preventDefault()
    try {
      await awardBonus(id, bonusForm)
      setBonusModal(false)
      loadTabData()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err.message)
    }
  }

  const handleAdjustLeave = async (e) => {
    e.preventDefault()
    try {
      await adjustLeaveBalance({
        worker_id: id,
        ...leaveForm,
      })
      setLeaveModal(false)
      loadTabData()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err.message)
    }
  }

  const handleInitiateSep = async (e) => {
    e.preventDefault()
    try {
      await initiateSeparation({
        worker_id: id,
        ...sepForm,
      })
      setSepModal(false)
      loadTabData()
      loadWorker()
    } catch (err) {
      alert(err?.response?.data?.detail?.message || err.message)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">Loading 360° employee profile...</div>
  }

  if (!worker) {
    return (
      <div className="p-8 text-center text-rose-400">
        Employee record not found. <Link to="/people/employees" className="underline">Back to Directory</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Profile Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl">
            {worker.first_name[0]}{worker.last_name[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{worker.name || `${worker.first_name} ${worker.last_name}`}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs border ${
                  WORKER_STATUS_BADGES[worker.status] || 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {worker.status}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">{worker.designation}</p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mt-2">
              <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                {worker.worker_code}
              </span>
              <span>{worker.work_email}</span>
              <span>Joined: {formatDate(worker.date_of_joining)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setHikeModal(true)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition"
          >
            Record Hike
          </button>
          <button
            onClick={() => setBonusModal(true)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition"
          >
            Award Bonus
          </button>
          <button
            onClick={() => setSepModal(true)}
            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition"
          >
            Initiate Exit
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto text-sm">
        {['overview', 'timeline', 'attendance', 'leaves', 'compensation', 'separation'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
              activeTab === tab
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Employment Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block">Employment Type</span>
                <span className="text-zinc-200 capitalize">{worker.employment_type}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Job Title</span>
                <span className="text-zinc-200">{worker.job_title || worker.designation}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Manager</span>
                <span className="text-zinc-200">{worker.manager?.name || 'Top-level / Executive'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Direct Reports</span>
                <span className="text-zinc-200">{worker.direct_reports_count || 0} direct reports</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Date of Joining</span>
                <span className="text-zinc-200">{formatDate(worker.date_of_joining)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Last Working Date</span>
                <span className="text-zinc-200">{formatDate(worker.last_working_date) || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Emergency & Banking Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block">Emergency Contact</span>
                <span className="text-zinc-200">{worker.emergency_contact_name || '-'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Emergency Phone</span>
                <span className="text-zinc-200">{worker.emergency_contact_phone || '-'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Bank Name</span>
                <span className="text-zinc-200">{worker.bank_name || '-'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Account Number</span>
                <span className="text-zinc-200">{worker.bank_account_no ? `•••• ${worker.bank_account_no.slice(-4)}` : '-'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Tax ID / PAN</span>
                <span className="text-zinc-200">{worker.tax_id || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Career Milestones & Chronological Timeline
          </h3>
          <div className="relative border-l border-zinc-800 ml-4 space-y-6">
            {(worker.timeline || []).map((t, idx) => (
              <div key={idx} className="relative pl-6">
                <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-900" />
                <div className="text-xs text-zinc-500">{formatDate(t.effective_date)}</div>
                <div className="text-sm font-medium text-zinc-200 mt-0.5">{t.title}</div>
                {t.description && <div className="text-xs text-zinc-400 mt-1">{t.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Attendance */}
      {activeTab === 'attendance' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Recent Attendance Punches & Overtime Records
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-800/60 uppercase text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Clock In</th>
                  <th className="px-4 py-2">Clock Out</th>
                  <th className="px-4 py-2">Working Mins</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-4 text-center text-zinc-500">
                      No attendance punches logged yet.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id}>
                      <td className="px-4 py-2 font-mono">{att.work_date}</td>
                      <td className="px-4 py-2">{formatDateTime(att.clock_in_time)}</td>
                      <td className="px-4 py-2">{formatDateTime(att.clock_out_time)}</td>
                      <td className="px-4 py-2">{att.working_minutes} mins</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border ${
                            ATTENDANCE_STATUS_BADGES[att.status] || 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Leaves */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Leave Balances (Double-Entry Ledger)
            </h3>
            <button
              onClick={() => setLeaveModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
            >
              Adjust / Set Opening Balance
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {balances.map((b) => (
              <div key={b.leave_plan_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-400 block">{b.plan_name}</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  {b.current_balance} <span className="text-xs font-normal text-zinc-500">days</span>
                </span>
                <span className="text-[10px] text-zinc-500 uppercase mt-2 block font-mono">
                  {b.plan_code} {b.is_encashable ? '• Encashable' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Compensation & Progression */}
      {activeTab === 'compensation' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4">
              Current Compensation CTC Breakdown
            </h3>
            {salaryStruct ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 block">Annual CTC</span>
                  <span className="text-lg font-bold text-zinc-100">{formatCurrency(salaryStruct.annual_ctc, salaryStruct.currency)}</span>
                </div>
                <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 block">Monthly Basic</span>
                  <span className="text-lg font-bold text-zinc-100">{formatCurrency(salaryStruct.basic_salary, salaryStruct.currency)}</span>
                </div>
                <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 block">HRA</span>
                  <span className="text-lg font-bold text-zinc-100">{formatCurrency(salaryStruct.hra, salaryStruct.currency)}</span>
                </div>
                <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-500 block">Effective From</span>
                  <span className="text-lg font-bold text-zinc-100">{formatDate(salaryStruct.effective_from)}</span>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 text-xs">No active salary structure defined.</div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Appraisals & Salary Hike History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-800/60 uppercase text-zinc-400">
                  <tr>
                    <th className="px-4 py-2">Effective Date</th>
                    <th className="px-4 py-2">Revision Type</th>
                    <th className="px-4 py-2">Previous CTC</th>
                    <th className="px-4 py-2">Increment %</th>
                    <th className="px-4 py-2">New Annual CTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {revisions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-zinc-500">
                        No compensation revisions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    revisions.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-mono">{r.effective_date}</td>
                        <td className="px-4 py-2 capitalize">{r.revision_type}</td>
                        <td className="px-4 py-2">{formatCurrency(r.previous_annual_ctc)}</td>
                        <td className="px-4 py-2 text-emerald-400 font-semibold">+{r.increment_pct}%</td>
                        <td className="px-4 py-2 font-bold text-zinc-100">{formatCurrency(r.new_annual_ctc)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Separation */}
      {activeTab === 'separation' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Offboarding & Separation Pipeline
          </h3>
          {separations.length === 0 ? (
            <div className="text-xs text-zinc-500">No separation initiated for this employee.</div>
          ) : (
            separations.map((sep) => (
              <div key={sep.id} className="border border-zinc-800 p-4 rounded-xl space-y-3 bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400">{sep.separation_code}</span>
                  <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                    {sep.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Resignation Date</span>
                    <span className="text-zinc-200">{formatDate(sep.resignation_date)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Agreed LWD</span>
                    <span className="text-zinc-200">{formatDate(sep.agreed_lwd)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Type</span>
                    <span className="text-zinc-200 capitalize">{sep.separation_type}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Record Hike Modal */}
      {hikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Record Salary Hike / Appraisal</h3>
            <form onSubmit={handleRecordHike} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Increment Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={hikeForm.increment_pct}
                  onChange={(e) => setHikeForm({ ...hikeForm, increment_pct: parseFloat(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Effective Date (Back-dating supported)</label>
                <input
                  type="date"
                  required
                  value={hikeForm.effective_date}
                  onChange={(e) => setHikeForm({ ...hikeForm, effective_date: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Appraisal Notes</label>
                <textarea
                  value={hikeForm.notes}
                  onChange={(e) => setHikeForm({ ...hikeForm, notes: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHikeModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium"
                >
                  Apply Hike
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Leave Balance Modal */}
      {leaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">Set Opening Balance / Adjust Leave</h3>
            <form onSubmit={handleAdjustLeave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Select Leave Plan</label>
                <select
                  required
                  value={leaveForm.leave_plan_id}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_plan_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Select Plan</option>
                  {balances.map((b) => (
                    <option key={b.leave_plan_id} value={b.leave_plan_id}>
                      {b.plan_name} ({b.plan_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Days Count (Units)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={leaveForm.units_days}
                  onChange={(e) => setLeaveForm({ ...leaveForm, units_days: parseFloat(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Effective Date (Back-dating supported)</label>
                <input
                  type="date"
                  required
                  value={leaveForm.effective_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, effective_date: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium"
                >
                  Post Ledger Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
