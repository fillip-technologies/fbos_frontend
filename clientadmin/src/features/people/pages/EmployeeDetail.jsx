import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getWorker,
  getWorkerBalances,
  getLeavePlans,
  adjustLeaveBalance,
  getSalaryStructure,
  createSalaryStructure,
  getCompensationRevisions,
  createCompensationRevision,
  getPromotions,
  getBonuses,
  awardBonus,
  initiateSeparation,
  getSeparations,
  getAttendance,
  getOnboarding,
  getWorkerRoleChanges,
} from '../api.js'
import { formatCurrency, formatDate, formatDateTime, statusLabel, toItem, toList, todayISO } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'
import EmployeeBank from '../components/EmployeeBank.jsx'
import EmployeeDocuments from '../components/EmployeeDocuments.jsx'
import EmployeeEditDialog from '../components/EmployeeEditDialog.jsx'
import RoleChangeDialog from '../components/RoleChangeDialog.jsx'
import RoleChangeList from '../components/RoleChangeList.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'

const TABS = ['overview', 'documents', 'bank', 'role changes', 'timeline', 'attendance', 'leaves', 'compensation', 'separation']
const NOTICE_DAYS = 30

const addDays = (days) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0]

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED']
const MONTHS_IN_YEAR = 12
const amount = (v) => Number(v) || 0
const newSalaryForm = (current) => ({
  currency: current?.currency || 'INR',
  basic_salary: current?.basic_salary ?? '',
  hra: current?.hra ?? '',
  special_allowance: current?.special_allowance ?? '',
  pf_deduction: current?.pf_deduction ?? '',
  pt_deduction: current?.pt_deduction ?? '',
  tds_tax: current?.tds_tax ?? '',
  effective_from: todayISO(),
})
// What a salary form's amounts add up to: monthly gross, monthly take-home and the yearly package.
const salaryTotals = (f) => {
  const gross = amount(f.basic_salary) + amount(f.hra) + amount(f.special_allowance)
  const deductions = amount(f.pf_deduction) + amount(f.pt_deduction) + amount(f.tds_tax)
  return { gross, deductions, net: gross - deductions, annual: gross * MONTHS_IN_YEAR }
}
const newHikeForm = () => ({ revision_type: 'annual_hike', increment_pct: 10, effective_date: todayISO(), notes: '' })
const newBonusForm = () => ({
  bonus_type: 'spot_award',
  amount: '',
  payout_month: todayISO().slice(0, 7),
  reason: '',
})
const newLeaveForm = () => ({
  leave_plan_id: '',
  transaction_type: 'opening_balance',
  units_days: 10,
  effective_date: todayISO(),
  description: '',
})
const newExitForm = () => ({
  separation_type: 'resignation',
  resignation_date: todayISO(),
  contractual_lwd: addDays(NOTICE_DAYS),
  agreed_lwd: addDays(NOTICE_DAYS),
  notice_shortfall_days: 0,
  reason: '',
})

function SalaryBreakdown({ salary }) {
  const c = salary.currency
  const money = (v) => formatCurrency(v, c)
  const net = amount(salary.gross_monthly) - amount(salary.pf_deduction) - amount(salary.pt_deduction) - amount(salary.tds_tax)
  const rows = [
    ['Basic', salary.basic_salary],
    ['House rent allowance (HRA)', salary.hra],
    ['Special allowance', salary.special_allowance],
  ]
  const cuts = [
    ['Provident fund (PF)', salary.pf_deduction],
    ['Professional tax', salary.pt_deduction],
    ['Income tax (TDS)', salary.tds_tax],
  ]
  return (
    <div>
      <div className="cards">
        <div className="panel"><div className="stat-label">Annual package (CTC)</div><div className="stat-value">{money(salary.annual_ctc)}</div></div>
        <div className="panel"><div className="stat-label">Gross per month</div><div className="stat-value">{money(salary.gross_monthly)}</div></div>
        <div className="panel"><div className="stat-label">Take-home per month</div><div className="stat-value">{money(net)}</div></div>
        <div className="panel"><div className="stat-label">Effective from</div><div className="stat-value">{formatDate(salary.effective_from)}</div></div>
      </div>
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead><tr><th>Component</th><th className="right">Per month</th><th className="right">Per year</th></tr></thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}><td>{label}</td><td className="right">{money(value)}</td><td className="right">{money(amount(value) * MONTHS_IN_YEAR)}</td></tr>
            ))}
            <tr><td><strong>Gross earnings</strong></td><td className="right"><strong>{money(salary.gross_monthly)}</strong></td><td className="right"><strong>{money(amount(salary.gross_monthly) * MONTHS_IN_YEAR)}</strong></td></tr>
            {cuts.map(([label, value]) => (
              <tr key={label}><td>{label}</td><td className="right amount-neg">-{money(value)}</td><td className="right amount-neg">-{money(amount(value) * MONTHS_IN_YEAR)}</td></tr>
            ))}
            <tr><td><strong>Take-home</strong></td><td className="right"><strong>{money(net)}</strong></td><td className="right"><strong>{money(net * MONTHS_IN_YEAR)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Detail = ({ label, children }) => (
  <div>
    <dt>{label}</dt>
    <dd>{children || <span className="muted">—</span>}</dd>
  </div>
)

export default function EmployeeDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(user, ACCESS.manageEmployees)
  const canSeeBank = canManage || hasAccess(user, ACCESS.compensation)
  const canReveal = hasAccess(user, ACCESS.compensation)
  const canSeePay = canReveal
  const canManagePay = hasAccess(user, ACCESS.manageCompensation)
  const [onboarding, setOnboarding] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleChanges, setRoleChanges] = useState([])
  const [roleChangesLoading, setRoleChangesLoading] = useState(true)
  const canApproveRoleChanges = hasAccess(user, ACCESS.approveRoleChanges)
  const { units } = useAccessCatalog(orgId)
  const unitNames = Object.fromEntries((units || []).map((u) => [u.id, u.name]))
  const [worker, setWorker] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Sub-resource states
  const [balances, setBalances] = useState([])
  const [leavePlans, setLeavePlans] = useState([])
  const [salaryStruct, setSalaryStruct] = useState(null)
  const [revisions, setRevisions] = useState([])
  const [promotions, setPromotions] = useState([])
  const [bonuses, setBonuses] = useState([])
  const [separations, setSeparations] = useState([])
  const [attendance, setAttendance] = useState([])
  const [tabError, setTabError] = useState(null)

  // One open form at a time: 'hike' | 'bonus' | 'leave' | 'exit'.
  const [dialog, setDialog] = useState(null)
  const [forms, setForms] = useState({
    hike: newHikeForm(),
    bonus: newBonusForm(),
    leave: newLeaveForm(),
    exit: newExitForm(),
    salary: newSalaryForm(),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const setForm = (name, patch) => setForms((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }))

  const openDialog = (name) => {
    setForms((prev) => ({
      ...prev,
      hike: newHikeForm(),
      bonus: newBonusForm(),
      leave: newLeaveForm(),
      exit: newExitForm(),
      salary: newSalaryForm(salaryStruct),
    }))
    setError(null)
    setDialog(name)
  }

  const loadWorker = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      setWorker(toItem(await getWorker(id)))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async () => {
    if (!id) return
    try {
      setTabError(null)
      if (activeTab === 'leaves') {
        setBalances(toList(await getWorkerBalances(id)))
      } else if (activeTab === 'compensation') {
        const [structRes, revRes, promoRes, bonusRes] = await Promise.all([
          getSalaryStructure(id),
          getCompensationRevisions(id),
          getPromotions(id),
          getBonuses(id),
        ])
        setSalaryStruct(toItem(structRes))
        setRevisions(toList(revRes))
        setPromotions(toList(promoRes))
        setBonuses(toList(bonusRes))
      } else if (activeTab === 'separation') {
        setSeparations(toList(await getSeparations({ worker_id: id })))
      } else if (activeTab === 'attendance') {
        setAttendance(toList(await getAttendance({ worker_id: id })))
      }
    } catch (err) {
      setTabError(err)
    }
  }

  const loadOnboarding = () => getOnboarding(id).then(setOnboarding).catch(() => setOnboarding(null))

  const loadRoleChanges = () => {
    setRoleChangesLoading(true)
    return getWorkerRoleChanges(id)
      .then((res) => setRoleChanges(toList(res)))
      .catch(() => setRoleChanges([]))
      .finally(() => setRoleChangesLoading(false))
  }

  useEffect(() => {
    loadWorker()
    loadOnboarding()
    loadRoleChanges()
  }, [id])

  useEffect(() => {
    loadTabData()
  }, [id, activeTab])

  // A form may be opened from any tab, so fetch what it needs when it opens.
  useEffect(() => {
    if (roleDialogOpen && canSeePay && !salaryStruct) {
      getSalaryStructure(id).then((res) => setSalaryStruct(toItem(res))).catch(() => {})
    }
  }, [roleDialogOpen])

  useEffect(() => {
    if (dialog === 'leave' && leavePlans.length === 0) {
      getLeavePlans().then((res) => setLeavePlans(toList(res))).catch(setError)
    }
    if (dialog === 'hike' && !salaryStruct) {
      getSalaryStructure(id).then((res) => setSalaryStruct(toItem(res))).catch(setError)
    }
  }, [dialog])

  // Runs a form's request, then closes it and refreshes what it changed.
  const submit = (request, { reloadWorker = false } = {}) => async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await request()
      setDialog(null)
      loadTabData()
      if (reloadWorker) loadWorker()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleRecordHike = (e) => {
    if (!salaryStruct?.annual_ctc) {
      e.preventDefault()
      setError(new Error('This employee has no salary structure yet, so a revision cannot be recorded.'))
      return
    }
    return submit(
      () =>
        createCompensationRevision(id, {
          ...forms.hike,
          increment_pct: Number(forms.hike.increment_pct),
          notes: forms.hike.notes.trim() || null,
          previous_annual_ctc: salaryStruct.annual_ctc,
        }),
      { reloadWorker: true },
    )(e)
  }

  const handleSetSalary = submit(
    () => {
      const f = forms.salary
      const totals = salaryTotals(f)
      return createSalaryStructure({
        worker_id: id,
        currency: f.currency,
        basic_salary: amount(f.basic_salary),
        hra: amount(f.hra),
        special_allowance: amount(f.special_allowance),
        pf_deduction: amount(f.pf_deduction),
        pt_deduction: amount(f.pt_deduction),
        tds_tax: amount(f.tds_tax),
        gross_monthly: totals.gross,
        annual_ctc: totals.annual,
        effective_from: f.effective_from,
        is_current: true,
      })
    },
    { reloadWorker: true },
  )

  const handleAwardBonus = submit(() =>
    awardBonus(id, {
      ...forms.bonus,
      amount: Number(forms.bonus.amount),
      reason: forms.bonus.reason.trim(),
    }),
  )

  const handleAdjustLeave = submit(() =>
    adjustLeaveBalance({
      worker_id: id,
      ...forms.leave,
      units_days: Number(forms.leave.units_days),
      description: forms.leave.description.trim() || 'Manual balance adjustment',
    }),
  )

  const handleInitiateExit = (e) => {
    const f = forms.exit
    if (f.contractual_lwd < f.resignation_date || f.agreed_lwd < f.resignation_date) {
      e.preventDefault()
      setError(new Error('Last working days cannot be earlier than the resignation date.'))
      return
    }
    return submit(
      () =>
        initiateSeparation({
          worker_id: id,
          ...f,
          notice_shortfall_days: Number(f.notice_shortfall_days),
          reason: f.reason.trim() || null,
        }),
      { reloadWorker: true },
    )(e)
  }

  if (loading) {
    return <div className="center-note">Loading employee profile...</div>
  }

  if (!worker) {
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={loadWorker} />
        <div className="panel center-note">
          Employee record not found. <Link to="/people/employees">Back to employees</Link>
        </div>
      </div>
    )
  }

  const displayName = worker.name || `${worker.first_name} ${worker.last_name}`

  return (
    <div>
      <p className="small" style={{ margin: '0 0 12px' }}>
        <Link to="/people/employees">← Employees</Link>
      </p>

      <div className="panel profile-head">
        <div className="profile-id">
          <div className="avatar">{`${worker.first_name?.[0] || ''}${worker.last_name?.[0] || ''}`}</div>
          <div>
            <h1>
              {displayName} <StatusBadge status={worker.status} label={statusLabel(worker.status)} />
            </h1>
            <div>{worker.designation}</div>
            <div className="muted small">
              {worker.worker_code && <span className="mono">{worker.worker_code} · </span>}
              {worker.work_email} · Joined {formatDate(worker.date_of_joining)}
            </div>
            {onboarding && (
              <div className="small" style={{ marginTop: 4 }}>
                Onboarding {onboarding.required_done} of {onboarding.required_total} verified
              </div>
            )}
          </div>
        </div>
        <div className="row-actions wrap">
          {canManage && <button type="button" className="btn secondary" onClick={() => setEditOpen(true)}>Edit</button>}
          {canManage && <button type="button" className="btn secondary" onClick={() => setRoleDialogOpen(true)}>Change role</button>}
          {canManagePay && <button type="button" className="btn secondary" onClick={() => openDialog('hike')}>Record hike</button>}
          {canManagePay && <button type="button" className="btn secondary" onClick={() => openDialog('bonus')}>Award bonus</button>}
          <button type="button" className="btn danger-outline" onClick={() => openDialog('exit')}>Start exit</button>
        </div>
      </div>

      <div className="tab-bar" role="tablist">
        {TABS.filter((tab) => (tab !== 'bank' || canSeeBank) && (tab !== 'compensation' || canSeePay)).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <ErrorBanner error={tabError} onRetry={loadTabData} />

      {activeTab === 'overview' && (
        <div className="two-col">
          <div className="panel">
            <h2 className="form-section" style={{ fontSize: 16 }}>Employment</h2>
            <dl className="detail-list">
              <Detail label="Employment type"><span style={{ textTransform: 'capitalize' }}>{statusLabel(worker.employment_type)}</span></Detail>
              <Detail label="Job title">{worker.job_title || worker.designation}</Detail>
              <Detail label="Manager">{worker.manager?.name || 'Top level'}</Detail>
              <Detail label="Direct reports">{String(worker.direct_reports_count || 0)}</Detail>
              <Detail label="Date of joining">{formatDate(worker.date_of_joining)}</Detail>
              <Detail label="Last working day">{worker.last_working_date && formatDate(worker.last_working_date)}</Detail>
            </dl>
          </div>
          <div className="panel">
            <h2 className="form-section" style={{ fontSize: 16 }}>Personal and emergency contact</h2>
            <dl className="detail-list">
              <Detail label="Personal email">{worker.personal_email}</Detail>
              <Detail label="Phone">{worker.phone}</Detail>
              <Detail label="Date of birth">{worker.date_of_birth && formatDate(worker.date_of_birth)}</Detail>
              <Detail label="Gender"><span style={{ textTransform: 'capitalize' }}>{worker.gender}</span></Detail>
              <Detail label="Blood group">{worker.blood_group}</Detail>
              <Detail label="Address">{worker.residential_address}</Detail>
              <Detail label="Emergency contact">
                {worker.emergency_contact_name &&
                  `${worker.emergency_contact_name}${worker.emergency_contact_relation ? ` (${worker.emergency_contact_relation})` : ''}`}
              </Detail>
              <Detail label="Emergency phone">{worker.emergency_contact_phone}</Detail>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <EmployeeDocuments
          orgId={orgId}
          workerId={id}
          canManage={canManage}
          canReveal={canReveal}
          onOpenBank={() => setActiveTab('bank')}
        />
      )}

      {activeTab === 'bank' && canSeeBank && (
        <EmployeeBank
          workerId={id}
          workerName={displayName}
          canManage={canManage}
          canReveal={canReveal}
          onChanged={loadOnboarding}
        />
      )}

      {activeTab === 'role changes' && (
        <RoleChangeList
          changes={roleChanges}
          loading={roleChangesLoading}
          me={user}
          canApprove={canApproveRoleChanges}
          canRequest={canManage}
          unitName={(unitId) => unitNames[unitId] || 'another department'}
          onChanged={() => {
            loadRoleChanges()
            loadWorker()
            loadOnboarding()
            if (canSeePay) getSalaryStructure(id).then((res) => setSalaryStruct(toItem(res))).catch(() => {})
          }}
        />
      )}

      {activeTab === 'timeline' && (
        <div className="panel">
          <h2 className="form-section" style={{ fontSize: 16 }}>Career timeline</h2>
          {(worker.timeline || []).length === 0 ? (
            <div className="muted">No milestones recorded yet.</div>
          ) : (
            <ul className="timeline">
              {worker.timeline.map((t) => (
                <li key={t.id}>
                  <div className="when">{formatDate(t.effective_date)}</div>
                  <strong>{t.title}</strong>
                  {t.description && <div className="muted small">{t.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table-plain">
            <thead>
              <tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Worked</th><th>Status</th></tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr><td colSpan={5} className="center-note">No attendance recorded yet.</td></tr>
              ) : (
                attendance.map((att) => (
                  <tr key={att.id}>
                    <td className="mono">{att.work_date}</td>
                    <td>{formatDateTime(att.clock_in_time)}</td>
                    <td>{formatDateTime(att.clock_out_time)}</td>
                    <td>{att.working_minutes > 0 ? `${Math.floor(att.working_minutes / 60)}h ${att.working_minutes % 60}m` : '—'}</td>
                    <td><StatusBadge status={att.status} label={statusLabel(att.status)} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="people-section">
          <div className="page-head">
            <h2 style={{ margin: 0, fontSize: 16 }}>Leave balances</h2>
            <button type="button" className="btn" onClick={() => openDialog('leave')}>Adjust balance</button>
          </div>
          {balances.length === 0 ? (
            <div className="panel center-note">No leave balances yet.</div>
          ) : (
            <div className="cards">
              {balances.map((b) => (
                <div key={b.leave_plan_id} className="panel">
                  <div className="stat-label">{b.plan_name}</div>
                  <div className="stat-value">{b.current_balance} <span className="stat-sub">days</span></div>
                  <div className="stat-sub mono">{b.plan_code}{b.is_encashable ? ' · encashable' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'compensation' && (
        <div>
          <div className="people-section">
            <div className="page-head" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Salary and package</h2>
              {canManagePay && (
                <button type="button" className="btn" onClick={() => openDialog('salary')}>
                  {salaryStruct ? 'Revise salary' : 'Set salary'}
                </button>
              )}
            </div>
            {salaryStruct ? <SalaryBreakdown salary={salaryStruct} /> : (
              <div className="panel center-note">No salary has been set for this employee yet.</div>
            )}
          </div>

          <div className="people-section">
            <h2>Hike history</h2>
            <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table-plain">
                <thead>
                  <tr><th>Effective</th><th>Type</th><th>Previous CTC</th><th>Increment</th><th>New CTC</th></tr>
                </thead>
                <tbody>
                  {revisions.length === 0 ? (
                    <tr><td colSpan={5} className="center-note">No revisions recorded yet.</td></tr>
                  ) : (
                    revisions.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.effective_date}</td>
                        <td style={{ textTransform: 'capitalize' }}>{statusLabel(r.revision_type)}</td>
                        <td>{formatCurrency(r.previous_annual_ctc)}</td>
                        <td className="amount-pos">+{r.increment_pct}%</td>
                        <td><strong>{formatCurrency(r.new_annual_ctc)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="two-col">
            <div className="people-section">
              <h2>Promotions</h2>
              <div className="panel">
                {promotions.length === 0 ? (
                  <div className="muted">No promotions recorded.</div>
                ) : (
                  <ul className="timeline">
                    {promotions.map((p) => (
                      <li key={p.id}>
                        <div className="when">{formatDate(p.effective_date)}</div>
                        <strong>{p.new_title}</strong>
                        {p.previous_title && <div className="muted small">from {p.previous_title}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="people-section">
              <h2>Bonuses</h2>
              <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="table-plain">
                  <thead><tr><th>Month</th><th>Type</th><th>Amount</th></tr></thead>
                  <tbody>
                    {bonuses.length === 0 ? (
                      <tr><td colSpan={3} className="center-note">No bonuses awarded.</td></tr>
                    ) : (
                      bonuses.map((b) => (
                        <tr key={b.id}>
                          <td className="mono">{b.payout_month}</td>
                          <td style={{ textTransform: 'capitalize' }}>{statusLabel(b.bonus_type)}</td>
                          <td><strong>{formatCurrency(b.amount, b.currency)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'separation' && (
        <div>
          {separations.length === 0 ? (
            <div className="panel center-note">No exit has been started for this employee.</div>
          ) : (
            separations.map((sep) => (
              <div key={sep.id} className="panel case-card">
                <div className="case-head">
                  <h3>
                    <span className="mono">{sep.separation_code}</span>{' '}
                    <StatusBadge status={sep.status} label={statusLabel(sep.status)} />
                  </h3>
                </div>
                <dl className="detail-list">
                  <Detail label="Resignation date">{formatDate(sep.resignation_date)}</Detail>
                  <Detail label="Agreed last working day">{formatDate(sep.agreed_lwd)}</Detail>
                  <Detail label="Type"><span style={{ textTransform: 'capitalize' }}>{statusLabel(sep.separation_type)}</span></Detail>
                </dl>
              </div>
            ))
          )}
        </div>
      )}

      {roleDialogOpen && (
        <RoleChangeDialog
          worker={worker}
          salary={canSeePay ? salaryStruct : null}
          units={units}
          onClose={() => setRoleDialogOpen(false)}
          onSaved={() => {
            setRoleDialogOpen(false)
            setActiveTab('role changes')
            loadRoleChanges()
          }}
        />
      )}

      {editOpen && (
        <EmployeeEditDialog
          worker={worker}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            loadWorker()
          }}
        />
      )}

      {dialog === 'salary' && (() => {
        const f = forms.salary
        const totals = salaryTotals(f)
        const money = (v) => formatCurrency(v, f.currency)
        const num = (name, label, required = false) => (
          <Field label={label} required={required} error={fieldErrors[name]}>
            <input type="number" min="0" step="0.01" value={f[name]} onChange={(e) => setForm('salary', { [name]: e.target.value })} />
          </Field>
        )
        return (
          <FormDialog
            wide
            title={salaryStruct ? 'Revise salary' : 'Set salary'}
            intro="Enter the monthly amounts. Gross, take-home and the yearly package are worked out for you. Saving makes this the current salary; the earlier one stays on record."
            onClose={() => setDialog(null)}
            onSubmit={handleSetSalary}
            submitLabel="Save salary"
            saving={saving}
            error={error}
          >
            <div className="grid-2">
              <Field label="Currency" error={fieldErrors.currency}>
                <select value={f.currency} onChange={(e) => setForm('salary', { currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Effective from" required hint="Past dates are fine." error={fieldErrors.effective_from}>
                <input type="date" value={f.effective_from} onChange={(e) => setForm('salary', { effective_from: e.target.value })} />
              </Field>
            </div>
            <h3 className="section-title" style={{ margin: '4px 0 10px' }}>Earnings (per month)</h3>
            <div className="grid-2">
              {num('basic_salary', 'Basic', true)}
              {num('hra', 'House rent allowance (HRA)')}
              {num('special_allowance', 'Special allowance')}
            </div>
            <h3 className="section-title" style={{ margin: '4px 0 10px' }}>Deductions (per month)</h3>
            <div className="grid-2">
              {num('pf_deduction', 'Provident fund (PF)')}
              {num('pt_deduction', 'Professional tax')}
              {num('tds_tax', 'Income tax (TDS)')}
            </div>
            <div className="settlement-box">
              <div className="settlement-grid">
                <div><span className="stat-label">Gross per month</span><strong>{money(totals.gross)}</strong></div>
                <div><span className="stat-label">Take-home per month</span><strong>{money(totals.net)}</strong></div>
                <div><span className="stat-label">Annual package (CTC)</span><strong className="stat-value">{money(totals.annual)}</strong></div>
              </div>
            </div>
          </FormDialog>
        )
      })()}

      {dialog === 'hike' && (
        <FormDialog
          title="Record a salary hike"
          intro={
            salaryStruct?.annual_ctc
              ? `Current annual CTC is ${formatCurrency(salaryStruct.annual_ctc, salaryStruct.currency)}.`
              : 'This employee has no salary structure yet, so a hike cannot be recorded.'
          }
          onClose={() => setDialog(null)}
          onSubmit={handleRecordHike}
          submitLabel="Apply hike"
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="Type" error={fieldErrors.revision_type}>
              <select value={forms.hike.revision_type} onChange={(e) => setForm('hike', { revision_type: e.target.value })}>
                <option value="annual_hike">Annual hike</option>
                <option value="promotion_hike">Promotion hike</option>
                <option value="market_correction">Market correction</option>
                <option value="probation_confirmation">Probation confirmation</option>
              </select>
            </Field>
            <Field label="Increment (%)" required error={fieldErrors.increment_pct}>
              <input type="number" step="0.1" min="0" value={forms.hike.increment_pct} onChange={(e) => setForm('hike', { increment_pct: e.target.value })} />
            </Field>
            <Field label="Effective date" required hint="Past dates are fine." error={fieldErrors.effective_date}>
              <input type="date" value={forms.hike.effective_date} onChange={(e) => setForm('hike', { effective_date: e.target.value })} />
            </Field>
          </div>
          <Field label="Appraisal notes" error={fieldErrors.notes}>
            <textarea rows={3} value={forms.hike.notes} onChange={(e) => setForm('hike', { notes: e.target.value })} />
          </Field>
        </FormDialog>
      )}

      {dialog === 'bonus' && (
        <FormDialog
          title="Award a bonus"
          onClose={() => setDialog(null)}
          onSubmit={handleAwardBonus}
          submitLabel="Award bonus"
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="Type" error={fieldErrors.bonus_type}>
              <select value={forms.bonus.bonus_type} onChange={(e) => setForm('bonus', { bonus_type: e.target.value })}>
                <option value="spot_award">Spot award</option>
                <option value="performance">Performance</option>
                <option value="referral">Referral</option>
                <option value="retention">Retention</option>
                <option value="festival">Festival</option>
              </select>
            </Field>
            <Field label="Amount" required error={fieldErrors.amount}>
              <input type="number" step="0.01" min="0.01" value={forms.bonus.amount} onChange={(e) => setForm('bonus', { amount: e.target.value })} />
            </Field>
            <Field label="Paid with payroll of" required error={fieldErrors.payout_month}>
              <input type="month" value={forms.bonus.payout_month} onChange={(e) => setForm('bonus', { payout_month: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason" required error={fieldErrors.reason}>
            <textarea rows={3} value={forms.bonus.reason} onChange={(e) => setForm('bonus', { reason: e.target.value })} />
          </Field>
        </FormDialog>
      )}

      {dialog === 'leave' && (
        <FormDialog
          title="Adjust leave balance"
          intro="Adds days to (or removes them from) this employee's balance. Use it to set opening balances too."
          onClose={() => setDialog(null)}
          onSubmit={handleAdjustLeave}
          submitLabel="Post entry"
          savingLabel="Posting..."
          saving={saving}
          error={error}
        >
          <Field label="Leave plan" required error={fieldErrors.leave_plan_id}>
            <select value={forms.leave.leave_plan_id} onChange={(e) => setForm('leave', { leave_plan_id: e.target.value })}>
              <option value="">Select a plan</option>
              {leavePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Entry" error={fieldErrors.transaction_type}>
              <select value={forms.leave.transaction_type} onChange={(e) => setForm('leave', { transaction_type: e.target.value })}>
                <option value="opening_balance">Opening balance</option>
                <option value="adjustment">Adjustment</option>
                <option value="comp_off_credit">Comp-off credit</option>
              </select>
            </Field>
            <Field label="Days" required hint="Use a negative number to remove days." error={fieldErrors.units_days}>
              <input type="number" step="0.5" value={forms.leave.units_days} onChange={(e) => setForm('leave', { units_days: e.target.value })} />
            </Field>
            <Field label="Effective date" required error={fieldErrors.effective_date}>
              <input type="date" value={forms.leave.effective_date} onChange={(e) => setForm('leave', { effective_date: e.target.value })} />
            </Field>
            <Field label="Note" error={fieldErrors.description}>
              <input type="text" value={forms.leave.description} onChange={(e) => setForm('leave', { description: e.target.value })} placeholder="Manual balance adjustment" />
            </Field>
          </div>
        </FormDialog>
      )}

      {dialog === 'exit' && (
        <FormDialog
          wide
          title="Start an exit"
          intro="Starts the offboarding case: department clearances first, then the full-and-final settlement."
          onClose={() => setDialog(null)}
          onSubmit={handleInitiateExit}
          submitLabel="Start exit"
          savingLabel="Starting..."
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="Type" error={fieldErrors.separation_type}>
              <select value={forms.exit.separation_type} onChange={(e) => setForm('exit', { separation_type: e.target.value })}>
                <option value="resignation">Resignation</option>
                <option value="termination">Termination</option>
                <option value="mutual_separation">Mutual separation</option>
                <option value="retirement">Retirement</option>
              </select>
            </Field>
            <Field label="Resignation date" required hint="Past dates are fine." error={fieldErrors.resignation_date}>
              <input type="date" value={forms.exit.resignation_date} onChange={(e) => setForm('exit', { resignation_date: e.target.value })} />
            </Field>
            <Field label="Last working day (contract)" required error={fieldErrors.contractual_lwd}>
              <input type="date" value={forms.exit.contractual_lwd} onChange={(e) => setForm('exit', { contractual_lwd: e.target.value })} />
            </Field>
            <Field label="Last working day (agreed)" required error={fieldErrors.agreed_lwd}>
              <input type="date" value={forms.exit.agreed_lwd} onChange={(e) => setForm('exit', { agreed_lwd: e.target.value })} />
            </Field>
            <Field label="Notice shortfall (days)" hint="Days short of the notice period." error={fieldErrors.notice_shortfall_days}>
              <input type="number" min="0" value={forms.exit.notice_shortfall_days} onChange={(e) => setForm('exit', { notice_shortfall_days: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason" error={fieldErrors.reason}>
            <textarea rows={3} value={forms.exit.reason} onChange={(e) => setForm('exit', { reason: e.target.value })} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
