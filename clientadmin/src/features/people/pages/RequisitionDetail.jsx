import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { applyCandidate, getApplications, getCandidates, getRequisition } from '../api.js'
import { formatDate, statusLabel, toItem, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ApplicationDialog, { STAGES } from '../components/ApplicationDialog.jsx'
import CandidateDialog from '../components/CandidateDialog.jsx'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

// One job: its hiring pipeline, one column per stage.
export default function RequisitionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const canManage = hasAccess(user, ACCESS.manageRecruitment)
  const [requisition, setRequisition] = useState(null)
  const [applications, setApplications] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // application being viewed
  const [applyOpen, setApplyOpen] = useState(false)
  const [newCandidateOpen, setNewCandidateOpen] = useState(false)
  const [candidateId, setCandidateId] = useState('')
  const [saving, setSaving] = useState(false)
  const [applyError, setApplyError] = useState(null)
  const fieldErrors = getFieldErrors(applyError)

  const load = async () => {
    try {
      setLoadError(null)
      const [req, apps, cands] = await Promise.all([
        getRequisition(id),
        getApplications({ requisition_id: id }),
        getCandidates(),
      ])
      setRequisition(toItem(req))
      setApplications(toList(apps))
      setCandidates(toList(cands))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])
  const applied = useMemo(() => new Set(applications.map((a) => a.candidate_id)), [applications])
  const available = candidates.filter((c) => !applied.has(c.id))
  const nameOf = (cid) => {
    const c = byId.get(cid)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown candidate'
  }
  // Keep the open dialog pointing at fresh data after a stage change.
  const current = selected && applications.find((a) => a.id === selected)

  const apply = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setApplyError(null)
      await applyCandidate({ candidate_id: candidateId, requisition_id: id })
      setApplyOpen(false)
      setCandidateId('')
      load()
    } catch (err) {
      setApplyError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="muted small" style={{ margin: 0 }}><Link to="/people/jobs">← Recruitment</Link></p>
          <h1>{requisition?.title || 'Job'}</h1>
          {requisition && (
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              <span className="mono">{requisition.requisition_code}</span>
              {requisition.department && <> · {requisition.department}</>}
              {' · '}{requisition.filled_count} of {requisition.openings_count} filled · opened {formatDate(requisition.created_at)}{' '}
              <StatusBadge status={requisition.status} label={statusLabel(requisition.status)} />
            </p>
          )}
        </div>
        {canManage && (
          <button type="button" className="btn" onClick={() => { setApplyError(null); setApplyOpen(true) }}>
            + Add candidate
          </button>
        )}
      </div>

      <ErrorBanner error={loadError} onRetry={load} />
      {loading && <div className="panel center-note">Loading pipeline...</div>}

      {!loading && requisition && (
        <div className="board">
          {STAGES.map((stage) => {
            const cards = applications.filter((a) => a.current_stage === stage)
            return (
              <div className="board-column" key={stage}>
                <div className="board-column-head">
                  <span style={{ textTransform: 'capitalize' }}>{stage}</span>
                  <span className="count">{cards.length}</span>
                </div>
                <div className="board-cards">
                  {cards.length === 0 && <div className="board-empty muted small">No one here</div>}
                  {cards.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="panel"
                      style={{ textAlign: 'left', cursor: 'pointer', padding: 10 }}
                      onClick={() => setSelected(a.id)}
                    >
                      <strong>{nameOf(a.candidate_id)}</strong>
                      <div className="muted small">{byId.get(a.candidate_id)?.email}</div>
                      <div className="muted small">Applied {formatDate(a.applied_at)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {current && (
        <ApplicationDialog
          application={current}
          candidate={byId.get(current.candidate_id)}
          requisition={requisition}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}

      {applyOpen && (
        <FormDialog
          title="Add candidate to this job"
          intro="Pick someone from the talent pool, or add a new candidate."
          onClose={() => setApplyOpen(false)}
          onSubmit={apply}
          submitLabel="Add to pipeline"
          savingLabel="Adding..."
          saving={saving}
          error={applyError}
        >
          <Field label="Candidate" required error={fieldErrors.candidate_id}>
            <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">Choose a candidate</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>
              ))}
            </select>
          </Field>
          <button type="button" className="link-btn" onClick={() => setNewCandidateOpen(true)}>
            Candidate not listed? Add a new one
          </button>
        </FormDialog>
      )}

      {newCandidateOpen && (
        <CandidateDialog
          onClose={() => setNewCandidateOpen(false)}
          onCreated={async (candidate) => {
            setNewCandidateOpen(false)
            await load()
            setCandidateId(candidate.id)
          }}
        />
      )}
    </div>
  )
}
