import { useState, useEffect } from 'react'
import { getPayrollRuns, createPayrollRun, disbursePayrollRun, getReimbursements, approveReimbursement } from '../api.js'
import { formatCurrency, formatDate, statusLabel, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const newForm = () => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })

export default function PayrollHub() {
  const [runs, setRuns] = useState([])
  const [reimbursements, setReimbursements] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(newForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [runRes, claimRes] = await Promise.all([getPayrollRuns(), getReimbursements()])
      setRuns(toList(runRes))
      setReimbursements(toList(claimRes))
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
    setForm(newForm())
    setError(null)
    setModalOpen(true)
  }

  const handleCreateRun = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createPayrollRun({ year: Number(form.year), month: Number(form.month) })
      setModalOpen(false)
      loadData()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const act = async (action) => {
    try {
      setActionError(null)
      await action()
      loadData()
    } catch (err) {
      setActionError(err)
    }
  }

  const handleDisburse = (id) => {
    if (!window.confirm('Disburse this payroll run? This finalizes the payslips and queues the payments.')) return
    act(() => disbursePayrollRun(id))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Payroll &amp; Expenses</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Monthly pay runs, payslips and expense claims.
          </p>
        </div>
        <button type="button" className="btn" onClick={openForm}>
          + Run payroll
        </button>
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />
      <ErrorBanner error={actionError} />

      <div className="people-section">
        <h2>Pay runs</h2>
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table-plain">
            <thead>
              <tr>
                <th>Code</th>
                <th>Period</th>
                <th>Employees</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="center-note">Loading pay runs...</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={8} className="center-note">No pay runs yet.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.payroll_code}</td>
                    <td><strong>{MONTHS[r.month - 1] || r.month} {r.year}</strong></td>
                    <td>{r.total_workers}</td>
                    <td>{formatCurrency(r.total_gross)}</td>
                    <td className="amount-neg">-{formatCurrency(r.total_deductions)}</td>
                    <td><strong>{formatCurrency(r.total_net)}</strong></td>
                    <td><StatusBadge status={r.status} label={statusLabel(r.status)} /></td>
                    <td className="right">
                      {r.status === 'calculated' && (
                        <button type="button" className="btn small-btn" onClick={() => handleDisburse(r.id)}>
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

      <div className="people-section">
        <h2>Expense claims</h2>
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table-plain">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="center-note">Loading expense claims...</td></tr>
              ) : reimbursements.length === 0 ? (
                <tr><td colSpan={7} className="center-note">No expense claims yet.</td></tr>
              ) : (
                reimbursements.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.claim_code}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.category}</td>
                    <td><strong>{formatCurrency(c.amount, c.currency)}</strong></td>
                    <td>{formatDate(c.spent_date)}</td>
                    <td className="muted small">{c.description || '—'}</td>
                    <td><StatusBadge status={c.status} label={statusLabel(c.status)} /></td>
                    <td className="right">
                      {c.status === 'submitted' && (
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn small-btn"
                            onClick={() => act(() => approveReimbursement(c.id, true))}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger-outline small-btn"
                            onClick={() => act(() => approveReimbursement(c.id, false))}
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
          title="Run payroll"
          intro="Calculates payslips for every active employee for the month. Nothing is paid until you disburse the run."
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreateRun}
          submitLabel="Calculate payroll"
          savingLabel="Calculating..."
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="Month" required error={fieldErrors.month}>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </Field>
            <Field label="Year" required error={fieldErrors.year}>
              <input
                type="number"
                min="2000"
                max="2100"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
