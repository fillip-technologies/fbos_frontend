import { useState, useEffect } from 'react'
import { getRequisitions, createRequisition, getPositions } from '../api.js'
import { formatDate, statusLabel, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const EMPTY_FORM = {
  title: '',
  department: '',
  position_id: '',
  openings_count: 1,
}

export default function RecruitmentJobs() {
  const [requisitions, setRequisitions] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [reqRes, posRes] = await Promise.all([getRequisitions(), getPositions()])
      setRequisitions(toList(reqRes))
      setPositions(toList(posRes))
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

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createRequisition({
        ...form,
        title: form.title.trim(),
        department: form.department.trim() || null,
        position_id: form.position_id || null,
        openings_count: Number(form.openings_count),
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
          <h1>Recruitment</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Job requisitions and the positions they fill.
          </p>
        </div>
        <button type="button" className="btn" onClick={openForm}>
          + Open requisition
        </button>
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              <th>Code</th>
              <th>Job title</th>
              <th>Department</th>
              <th>Openings</th>
              <th>Filled</th>
              <th>Status</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="center-note">Loading requisitions...</td></tr>
            ) : requisitions.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No job requisitions yet.</td></tr>
            ) : (
              requisitions.map((req) => (
                <tr key={req.id}>
                  <td className="mono">{req.requisition_code}</td>
                  <td><strong>{req.title}</strong></td>
                  <td>{req.department || <span className="muted">—</span>}</td>
                  <td>{req.openings_count}</td>
                  <td>{req.filled_count}</td>
                  <td><StatusBadge status={req.status} label={statusLabel(req.status)} /></td>
                  <td className="muted small">{formatDate(req.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <FormDialog
          title="Open a requisition"
          intro="Describe the role you are hiring for. Link it to a position seat so the seat is marked filled when someone is hired."
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
          submitLabel="Open requisition"
          savingLabel="Opening..."
          saving={saving}
          error={error}
        >
          <Field label="Job title" required error={fieldErrors.title}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Senior Backend Engineer"
              autoFocus
            />
          </Field>
          <div className="grid-2">
            <Field label="Department" error={fieldErrors.department}>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Engineering"
              />
            </Field>
            <Field label="Openings" required error={fieldErrors.openings_count}>
              <input
                type="number"
                min="1"
                value={form.openings_count}
                onChange={(e) => setForm({ ...form, openings_count: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Position seat"
            hint="Optional. Leave empty to keep the requisition as a draft without a seat."
            error={fieldErrors.position_id}
          >
            <select value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
              <option value="">No position seat</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.position_code} - {p.title} ({statusLabel(p.hiring_status)})
                </option>
              ))}
            </select>
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
