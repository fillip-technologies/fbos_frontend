import { useEffect, useState } from 'react'
import { getMyInterviews, submitInterviewFeedback } from '../api.js'
import { formatDateTime, statusLabel, toList } from '../utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import FormDialog from '../components/FormDialog.jsx'
import Field from '../components/Field.jsx'

const RECOMMENDATIONS = ['strong_yes', 'yes', 'neutral', 'no', 'strong_no']

// The interviews assigned to the signed-in employee, and the feedback form for each.
export default function MyInterviews() {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [giving, setGiving] = useState(null)
  const [form, setForm] = useState({ overall_recommendation: 'yes', feedback_notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const load = async () => {
    try {
      setLoadError(null)
      setInterviews(toList(await getMyInterviews()))
    } catch (err) {
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await submitInterviewFeedback(giving.id, {
        overall_recommendation: form.overall_recommendation,
        feedback_notes: form.feedback_notes.trim() || null,
      })
      setGiving(null)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const upcoming = interviews.filter((i) => i.status === 'scheduled')
  const past = interviews.filter((i) => i.status !== 'scheduled')

  const table = (rows, withAction) => (
    <div className="panel" style={{ padding: 0, overflowX: 'auto', marginBottom: 16 }}>
      <table className="table-plain">
        <thead>
          <tr><th>When</th><th>Candidate</th><th>Job</th><th>Round</th><th>Where</th><th>Status</th>{withAction && <th className="right">Action</th>}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={withAction ? 7 : 6} className="center-note">{loading ? 'Loading...' : 'Nothing here.'}</td></tr>
          ) : rows.map((i) => (
            <tr key={i.id}>
              <td>{formatDateTime(i.scheduled_at)}<div className="muted small">{i.duration_minutes} min</div></td>
              <td><strong>{i.candidate_name}</strong></td>
              <td>{i.job_title}</td>
              <td style={{ textTransform: 'capitalize' }}>{i.round_name}</td>
              <td>{i.location || <span className="muted">—</span>}</td>
              <td><StatusBadge status={i.status} label={statusLabel(i.status)} /></td>
              {withAction && (
                <td className="right">
                  <button
                    type="button"
                    className="btn small-btn"
                    onClick={() => { setForm({ overall_recommendation: 'yes', feedback_notes: '' }); setError(null); setGiving(i) }}
                  >
                    Give feedback
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My interviews</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Candidates you have been asked to interview. Your feedback stays hidden from other interviewers.
          </p>
        </div>
      </div>
      <ErrorBanner error={loadError} onRetry={load} />
      <h2 style={{ fontSize: 16 }}>To do</h2>
      {table(upcoming, true)}
      <h2 style={{ fontSize: 16 }}>Done or cancelled</h2>
      {table(past, false)}

      {giving && (
        <FormDialog
          title={`Feedback: ${giving.candidate_name}`}
          intro={`${giving.job_title} · ${giving.round_name} round`}
          onClose={() => setGiving(null)}
          onSubmit={submit}
          submitLabel="Submit feedback"
          savingLabel="Submitting..."
          saving={saving}
          error={error}
        >
          <Field label="Verdict" required error={fieldErrors.overall_recommendation}>
            <select value={form.overall_recommendation} onChange={(e) => setForm({ ...form, overall_recommendation: e.target.value })}>
              {RECOMMENDATIONS.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
            </select>
          </Field>
          <Field label="Notes" hint="Strengths, concerns, anything the hiring team should know." error={fieldErrors.feedback_notes}>
            <textarea rows={5} value={form.feedback_notes} onChange={(e) => setForm({ ...form, feedback_notes: e.target.value })} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
