import { useState, useEffect, useMemo } from 'react'
import { getAttendance, recordAttendance, getWorkers } from '../api.js'
import { formatDateTime, statusLabel, toList, todayISO } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const newForm = () => ({
  worker_id: '',
  work_date: todayISO(),
  clock_in_time: '',
  clock_out_time: '',
  status: 'present',
  notes: '',
})

const workerLabel = (w) => `${w.worker_code ? `${w.worker_code} - ` : ''}${w.first_name} ${w.last_name}`.trim()

export default function AttendanceBoard() {
  const [records, setRecords] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(newForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const workerNames = useMemo(() => Object.fromEntries(workers.map((w) => [w.id, workerLabel(w)])), [workers])

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [attRes, workerRes] = await Promise.all([getAttendance(), getWorkers({ limit: 100 })])
      setRecords(toList(attRes))
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
    setForm(newForm())
    setError(null)
    setModalOpen(true)
  }

  const handleRecord = async (e) => {
    e.preventDefault()
    if (form.clock_in_time && form.clock_out_time && form.clock_out_time <= form.clock_in_time) {
      setError(new Error('Clock out must be after clock in.'))
      return
    }
    try {
      setSaving(true)
      setError(null)
      await recordAttendance({
        ...form,
        clock_in_time: form.clock_in_time ? `${form.work_date}T${form.clock_in_time}:00Z` : null,
        clock_out_time: form.clock_out_time ? `${form.work_date}T${form.clock_out_time}:00Z` : null,
        notes: form.notes.trim() || null,
      })
      setModalOpen(false)
      loadData()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Daily attendance, overtime and regularization. Use manual entry to import past days.
          </p>
        </div>
        <button type="button" className="btn" onClick={openForm}>
          + Add attendance
        </button>
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Clock in</th>
              <th>Clock out</th>
              <th>Worked</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="center-note">Loading attendance...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No attendance records yet.</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.work_date}</td>
                  <td>{workerNames[r.worker_id] || <span className="mono muted">{r.worker_id}</span>}</td>
                  <td>{formatDateTime(r.clock_in_time)}</td>
                  <td>{formatDateTime(r.clock_out_time)}</td>
                  <td>
                    {r.working_minutes > 0 ? `${Math.floor(r.working_minutes / 60)}h ${r.working_minutes % 60}m` : '—'}
                  </td>
                  <td><StatusBadge status={r.status} label={statusLabel(r.status)} /></td>
                  <td className="muted small">{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <FormDialog
          title="Add attendance"
          intro="Enter a day by hand, for example when importing past attendance. Times are saved for the chosen date."
          onClose={() => setModalOpen(false)}
          onSubmit={handleRecord}
          submitLabel="Save record"
          saving={saving}
          error={error}
        >
          <Field label="Employee" required error={fieldErrors.worker_id}>
            <select value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}>
              <option value="">Select an employee</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{workerLabel(w)}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Date" required error={fieldErrors.work_date}>
              <input
                type="date"
                max={todayISO()}
                value={form.work_date}
                onChange={(e) => setForm({ ...form, work_date: e.target.value })}
              />
            </Field>
            <Field label="Status" error={fieldErrors.status}>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="present">Present</option>
                <option value="half_day">Half day</option>
                <option value="absent">Absent</option>
                <option value="holiday">Holiday</option>
                <option value="on_leave">On leave</option>
              </select>
            </Field>
            <Field label="Clock in" error={fieldErrors.clock_in_time}>
              <input
                type="time"
                value={form.clock_in_time}
                onChange={(e) => setForm({ ...form, clock_in_time: e.target.value })}
              />
            </Field>
            <Field label="Clock out" error={fieldErrors.clock_out_time}>
              <input
                type="time"
                value={form.clock_out_time}
                onChange={(e) => setForm({ ...form, clock_out_time: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes" error={fieldErrors.notes}>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Biometric sync"
            />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
