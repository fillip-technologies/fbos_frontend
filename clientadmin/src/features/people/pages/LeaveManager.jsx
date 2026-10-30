import { useState, useEffect, useMemo } from 'react'
import { getWorkers, getLeavePlans, createLeavePlan, getLeaveRequests, approveLeaveRequest } from '../api.js'
import { formatDate, statusLabel, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const EMPTY_FORM = {
  code: '',
  name: '',
  annual_quota: 12,
  accrual_frequency: 'annual',
  carryforward_max: 5,
  is_encashable: false,
}

export default function LeaveManager() {
  const [plans, setPlans] = useState([])
  const [requests, setRequests] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const workerNames = useMemo(
    () => Object.fromEntries(workers.map((w) => [w.id, `${w.first_name} ${w.last_name}`.trim()])),
    [workers],
  )

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [planRes, requestRes, workerRes] = await Promise.all([
        getLeavePlans(),
        getLeaveRequests(),
        getWorkers({ limit: 100 }),
      ])
      setPlans(toList(planRes))
      setRequests(toList(requestRes))
      setWorkers(toList(workerRes))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openForm = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createLeavePlan({
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        annual_quota: Number(form.annual_quota),
        carryforward_max: Number(form.carryforward_max),
      })
      setModalOpen(false)
      loadData()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (id, approved) => {
    try {
      setActionError(null)
      await approveLeaveRequest(id, approved)
      loadData()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leaves</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Leave plans, balances and manager approvals.
          </p>
        </div>
        <button type="button" className="btn" onClick={openForm}>
          + Create leave plan
        </button>
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />
      <ErrorBanner error={actionError} />

      <div className="people-section">
        <h2>Leave plans</h2>
        {plans.length === 0 ? (
          <div className="panel center-note">{loading ? 'Loading leave plans...' : 'No leave plans yet.'}</div>
        ) : (
          <div className="cards">
            {plans.map((p) => (
              <div key={p.id} className="panel">
                <div className="section-head">
                  <span className="mono">{p.code}</span>
                  {p.is_encashable && <span className="chip">Encashable</span>}
                </div>
                <div className="stat-value">{p.name}</div>
                <div className="stat-sub">{p.annual_quota} days a year</div>
                <div className="stat-sub">
                  Carry forward up to {p.carryforward_max} days ({statusLabel(p.accrual_frequency)})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="people-section">
        <h2>Leave applications</h2>
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table-plain">
            <thead>
              <tr>
                <th>Employee</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="center-note">Loading leave applications...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="center-note">No leave applications yet.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td>{workerNames[r.worker_id] || <span className="mono muted">{r.worker_id}</span>}</td>
                    <td>{formatDate(r.start_date)}</td>
                    <td>{formatDate(r.end_date)}</td>
                    <td><strong>{r.days_count}</strong></td>
                    <td>{r.reason || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={r.status} label={statusLabel(r.status)} /></td>
                    <td className="right">
                      {r.status === 'pending' && (
                        <div className="table-actions">
                          <button type="button" className="btn small-btn" onClick={() => handleApprove(r.id, true)}>
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger-outline small-btn"
                            onClick={() => handleApprove(r.id, false)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <FormDialog
          title="Create a leave plan"
          intro="A plan sets how many days of one kind of leave people get, and how much can roll over."
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreatePlan}
          submitLabel="Create plan"
          savingLabel="Creating..."
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="Code" required error={fieldErrors.code} hint="Short and unique, e.g. SICK_LEAVE">
              <input
                type="text"
                className="upper"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="SICK_LEAVE"
                autoFocus
              />
            </Field>
            <Field label="Name" required error={fieldErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sick and medical leave"
              />
            </Field>
            <Field label="Days per year" required error={fieldErrors.annual_quota}>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.annual_quota}
                onChange={(e) => setForm({ ...form, annual_quota: e.target.value })}
              />
            </Field>
            <Field label="Max carry forward (days)" required error={fieldErrors.carryforward_max}>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.carryforward_max}
                onChange={(e) => setForm({ ...form, carryforward_max: e.target.value })}
              />
            </Field>
            <Field label="Accrual" error={fieldErrors.accrual_frequency}>
              <select
                value={form.accrual_frequency}
                onChange={(e) => setForm({ ...form, accrual_frequency: e.target.value })}
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>
          </div>
          <div className="field check-field">
            <label htmlFor="is_encashable">
              <input
                id="is_encashable"
                type="checkbox"
                checked={form.is_encashable}
                onChange={(e) => setForm({ ...form, is_encashable: e.target.checked })}
              />
              Unused days can be paid out when someone leaves (full and final)
            </label>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
