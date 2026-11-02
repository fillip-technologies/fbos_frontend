import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getRequisitions, createRequisition, getPositions, getCandidates } from '../api.js'
import { formatDate, statusLabel, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'
import CandidateDialog from '../components/CandidateDialog.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

const EMPTY_FORM = {
  title: '',
  department: '',
  position_id: '',
  openings_count: 1,
}

export default function RecruitmentJobs() {
  const { user } = useAuth()
  const canManage = hasAccess(user, ACCESS.manageRecruitment)
  const [tab, setTab] = useState('requisitions')
  const [candidates, setCandidates] = useState([])
  const [search, setSearch] = useState('')
  const [candidateOpen, setCandidateOpen] = useState(false)
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
      const [reqRes, posRes, candRes] = await Promise.all([getRequisitions(), getPositions(), getCandidates()])
      setCandidates(toList(candRes))
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
            Job requisitions, candidates and the hiring pipeline. Open a job to move candidates through interviews and offers.
          </p>
        </div>
        {canManage && (
          tab === 'requisitions' ? (
            <button type="button" className="btn" onClick={openForm}>+ Open requisition</button>
          ) : (
            <button type="button" className="btn" onClick={() => setCandidateOpen(true)}>+ Add candidate</button>
          )
        )}
      </div>

      <ErrorBanner error={loadError} onRetry={loadData} />

      <div className="tab-bar" role="tablist">
        {['requisitions', 'candidates'].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'candidates' && (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: 12 }}>
            <input type="search" placeholder="Search by name, email or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <table className="table-plain">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Tags</th><th>Added</th></tr>
            </thead>
            <tbody>
              {(() => {
                const q = search.trim().toLowerCase()
                const rows = candidates.filter((c) =>
                  !q || `${c.first_name} ${c.last_name} ${c.email} ${(c.tags || []).join(' ')}`.toLowerCase().includes(q))
                if (loading) return <tr><td colSpan={6} className="center-note">Loading candidates...</td></tr>
                if (rows.length === 0) return <tr><td colSpan={6} className="center-note">No candidates yet.</td></tr>
                return rows.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.first_name} {c.last_name}</strong></td>
                    <td>{c.email}</td>
                    <td>{c.phone || <span className="muted">—</span>}</td>
                    <td style={{ textTransform: 'capitalize' }}>{statusLabel(c.source) || <span className="muted">—</span>}</td>
                    <td>{(c.tags || []).join(', ') || <span className="muted">—</span>}</td>
                    <td className="muted small">{formatDate(c.created_at)}</td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}

      {candidateOpen && (
        <CandidateDialog
          onClose={() => setCandidateOpen(false)}
          onCreated={() => { setCandidateOpen(false); loadData() }}
        />
      )}

      {tab === 'requisitions' && <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
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
                  <td className="mono"><Link to={`/people/jobs/${req.id}`}>{req.requisition_code}</Link></td>
                  <td><Link to={`/people/jobs/${req.id}`}><strong>{req.title}</strong></Link></td>
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
      </div>}

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
