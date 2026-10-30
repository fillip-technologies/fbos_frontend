import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getWorkers, createWorker } from '../api.js'
import { formatDate, statusLabel, toList, todayISO } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import ImportFromUsersModal from '../components/ImportFromUsersModal.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 300

const newForm = () => ({
  first_name: '',
  last_name: '',
  work_email: '',
  phone: '',
  designation: '',
  employment_type: 'full_time',
  status: 'active',
  date_of_joining: todayISO(),
  custom_worker_code: '',
})

export default function EmployeeDirectory() {
  const [workers, setWorkers] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState(newForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const loadData = async (cursor = null) => {
    const append = Boolean(cursor)
    try {
      append ? setLoadingMore(true) : setLoading(true)
      setLoadError(null)
      const params = { limit: PAGE_SIZE }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (cursor) params.cursor = cursor
      const res = await getWorkers(params)
      setWorkers((prev) => (append ? [...prev, ...toList(res)] : toList(res)))
      setNextCursor(res?.page?.has_more ? res.page.next_cursor : null)
    } catch (err) {
      setLoadError(err)
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadData(), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const openForm = () => {
    setForm(newForm())
    setError(null)
    setModalOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createWorker({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        work_email: form.work_email.trim(),
        phone: form.phone.trim() || null,
        designation: form.designation.trim(),
        custom_worker_code: form.custom_worker_code.trim() || null,
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
          <h1>Employees</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everyone who works here, with their role, joining date and status.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={() => setImportOpen(true)}>
            Add from users
          </button>
          <button type="button" className="btn" onClick={openForm}>
            + Add employee
          </button>
        </div>
      </div>

      <ErrorBanner error={loadError} onRetry={() => loadData()} />

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name, email or employee code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="on_leave">On leave</option>
          <option value="noticed">Serving notice</option>
          <option value="exited">Exited</option>
        </select>
      </div>

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Employee</th>
              <th>Designation</th>
              <th>Joined</th>
              <th>Status</th>
              <th className="right">Profile</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="center-note">Loading employees...</td></tr>
            ) : workers.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No employees found.</td></tr>
            ) : (
              workers.map((w) => (
                <tr key={w.id}>
                  <td className="mono">{w.worker_code || '—'}</td>
                  <td>
                    <strong>{w.name || `${w.first_name} ${w.last_name}`}</strong>
                    <div className="muted small">{w.work_email}</div>
                  </td>
                  <td>{w.designation}</td>
                  <td>{formatDate(w.date_of_joining)}</td>
                  <td><StatusBadge status={w.status} label={statusLabel(w.status)} /></td>
                  <td className="right">
                    <Link to={`/people/employees/${w.id}`}>Open →</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="row-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn secondary" onClick={() => loadData(nextCursor)} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {importOpen && (
        <ImportFromUsersModal onClose={() => setImportOpen(false)} onImported={() => loadData()} />
      )}

      {modalOpen && (
        <FormDialog
          wide
          title="Add an employee"
          intro="For people who have no user account yet, including existing staff with a past joining date. For people who already have one, use Add from users."
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
          submitLabel="Save employee"
          saving={saving}
          error={error}
        >
          <div className="grid-2">
            <Field label="First name" required error={fieldErrors.first_name}>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Last name" required error={fieldErrors.last_name}>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </Field>
            <Field label="Work email" required error={fieldErrors.work_email}>
              <input
                type="email"
                value={form.work_email}
                onChange={(e) => setForm({ ...form, work_email: e.target.value })}
              />
            </Field>
            <Field label="Phone" error={fieldErrors.phone}>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Designation" required error={fieldErrors.designation}>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. Senior Software Engineer"
              />
            </Field>
            <Field label="Employment type" error={fieldErrors.employment_type}>
              <select
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
              >
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contractor">Contractor</option>
                <option value="intern">Intern</option>
              </select>
            </Field>
            <Field
              label="Date of joining"
              required
              hint="Past dates are fine for existing staff."
              error={fieldErrors.date_of_joining}
            >
              <input
                type="date"
                value={form.date_of_joining}
                onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
              />
            </Field>
            <Field
              label="Employee code"
              hint="Optional. Leave empty and a code is generated."
              error={fieldErrors.custom_worker_code}
            >
              <input
                type="text"
                value={form.custom_worker_code}
                onChange={(e) => setForm({ ...form, custom_worker_code: e.target.value })}
                placeholder="e.g. EMP-2020-0042"
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
