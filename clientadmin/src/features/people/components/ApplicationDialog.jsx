import { useEffect, useState } from 'react'
import {
  acceptAndOnboardCandidate,
  createOffer,
  getOffers,
  getScorecards,
  submitScorecard,
  transitionApplicationStage,
} from '../api.js'
import { formatCurrency, formatDate, statusLabel, todayISO, toList } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import Field from './Field.jsx'

export const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
const RECOMMENDATIONS = ['strong_yes', 'yes', 'neutral', 'no', 'strong_no']

// One application: move it between stages, record interview feedback, send an offer, onboard the hire.
export default function ApplicationDialog({ application, candidate, requisition, canManage, onClose, onChanged }) {
  const [scorecards, setScorecards] = useState([])
  const [offers, setOffers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [score, setScore] = useState({ stage_name: 'interview', interviewer_name: '', overall_recommendation: 'yes', feedback_notes: '' })
  const [offer, setOffer] = useState({ base_annual_salary: '', sign_on_bonus: '0', currency: 'INR', expected_start_date: '', out_of_band_reason: '' })
  const [onboard, setOnboard] = useState(null) // the offer being accepted: { id, work_email, date_of_joining }
  const [onboarded, setOnboarded] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const name = candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Candidate'

  const load = async () => {
    try {
      setError(null)
      const [cards, offerRes] = await Promise.all([getScorecards(application.id), getOffers(application.id)])
      setScorecards(toList(cards))
      setOffers(toList(offerRes))
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => { load() }, [application.id])

  const run = async (action, { reload = true } = {}) => {
    try {
      setBusy(true)
      setError(null)
      const result = await action()
      onChanged()
      if (reload) await load()
      return result
    } catch (err) {
      setError(err)
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const moveTo = (stage, rejection_reason) =>
    run(() => transitionApplicationStage(application.id, { stage, rejection_reason: rejection_reason || null }), { reload: false })

  const reject = async (e) => {
    e.preventDefault()
    if (await moveTo('rejected', reason.trim())) onClose()
  }

  const addScore = async (e) => {
    e.preventDefault()
    const saved = await run(() => submitScorecard(application.id, {
      stage_name: score.stage_name,
      interviewer_name: score.interviewer_name.trim(),
      overall_recommendation: score.overall_recommendation,
      feedback_notes: score.feedback_notes.trim() || null,
      is_blinded: false,
    }))
    if (saved) setScore({ ...score, interviewer_name: '', feedback_notes: '' })
  }

  const sendOffer = async (e) => {
    e.preventDefault()
    const saved = await run(() => createOffer(application.id, {
      candidate_id: application.candidate_id,
      position_id: requisition?.position_id || null,
      base_annual_salary: Number(offer.base_annual_salary),
      sign_on_bonus: Number(offer.sign_on_bonus) || 0,
      currency: offer.currency.trim().toUpperCase() || 'INR',
      expected_start_date: offer.expected_start_date,
      out_of_band_reason: offer.out_of_band_reason.trim() || null,
    }))
    if (saved) setOffer({ ...offer, base_annual_salary: '', sign_on_bonus: '0', expected_start_date: '', out_of_band_reason: '' })
  }

  const accept = async (e) => {
    e.preventDefault()
    const worker = await run(() => acceptAndOnboardCandidate(onboard.id, {
      work_email: onboard.work_email.trim(),
      date_of_joining: onboard.date_of_joining || null,
    }))
    if (worker) {
      setOnboarded(worker)
      setOnboard(null)
    }
  }

  const closed = application.status === 'rejected' || application.status === 'hired'
  const setS = (k) => (e) => setScore({ ...score, [k]: e.target.value })
  const setO = (k) => (e) => setOffer({ ...offer, [k]: e.target.value })

  return (
    <Dialog title={name} onClose={onClose} wide>
      <p className="dialog-intro">
        {requisition?.title}
        {' · '}
        <StatusBadge status={application.status} label={statusLabel(application.status)} />
        {candidate?.email && <span className="muted"> · {candidate.email}</span>}
      </p>
      <ErrorBanner error={error} />

      {onboarded && (
        <div className="alert success">
          {name} is now an employee ({onboarded.worker_code || onboarded.work_email}). Find them under People &gt; Employees.
        </div>
      )}

      {canManage && !closed && (
        <div className="form-section">
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Stage</h3>
          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            {STAGES.filter((s) => s !== 'rejected').map((stage) => (
              <button
                key={stage}
                type="button"
                className={stage === application.current_stage ? 'btn small-btn' : 'btn secondary small-btn'}
                disabled={busy || stage === application.current_stage}
                onClick={() => moveTo(stage)}
                style={{ textTransform: 'capitalize' }}
              >
                {stage}
              </button>
            ))}
            <button type="button" className="btn secondary small-btn" disabled={busy} onClick={() => setRejecting(!rejecting)}>
              Reject
            </button>
          </div>
          {rejecting && (
            <form onSubmit={reject} style={{ marginTop: 10 }}>
              <Field label="Reason" hint="Kept on the application for your records.">
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              </Field>
              <button type="submit" className="btn" disabled={busy}>Confirm rejection</button>
            </form>
          )}
        </div>
      )}
      {application.status === 'rejected' && application.rejection_reason && (
        <p className="small amount-neg">Rejected: {application.rejection_reason}</p>
      )}

      <div className="form-section">
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Interview feedback</h3>
        {scorecards.length === 0 ? (
          <p className="muted small">No feedback yet.</p>
        ) : (
          <table className="table-plain">
            <thead><tr><th>Stage</th><th>Interviewer</th><th>Verdict</th><th>Notes</th></tr></thead>
            <tbody>
              {scorecards.map((c) => (
                <tr key={c.id}>
                  <td style={{ textTransform: 'capitalize' }}>{c.stage_name}</td>
                  <td>{c.interviewer_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{statusLabel(c.overall_recommendation)}</td>
                  <td className="small">{c.feedback_notes || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage && !closed && (
          <form onSubmit={addScore} style={{ marginTop: 12 }}>
            <div className="grid-2">
              <Field label="Interviewer" required error={fieldErrors.interviewer_name}>
                <input type="text" value={score.interviewer_name} onChange={setS('interviewer_name')} />
              </Field>
              <Field label="Round" required>
                <input type="text" value={score.stage_name} onChange={setS('stage_name')} placeholder="e.g. technical" />
              </Field>
              <Field label="Verdict" required error={fieldErrors.overall_recommendation}>
                <select value={score.overall_recommendation} onChange={setS('overall_recommendation')}>
                  {RECOMMENDATIONS.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <input type="text" value={score.feedback_notes} onChange={setS('feedback_notes')} />
              </Field>
            </div>
            <button type="submit" className="btn secondary" disabled={busy}>Add feedback</button>
          </form>
        )}
      </div>

      <div className="form-section">
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Offer</h3>
        {offers.length === 0 && <p className="muted small">No offer sent yet.</p>}
        {offers.map((o) => (
          <div key={o.id} className="panel" style={{ marginBottom: 8 }}>
            <strong>{formatCurrency(o.base_annual_salary, o.currency)}</strong> a year
            {Number(o.sign_on_bonus) > 0 && <> + {formatCurrency(o.sign_on_bonus, o.currency)} sign-on</>}
            {' · starts '}{formatDate(o.expected_start_date)}{' · '}
            <StatusBadge status={o.status} label={statusLabel(o.status)} />
            {o.is_out_of_band && <div className="small amount-neg">Outside the pay band: {o.out_of_band_reason}</div>}
            {canManage && application.status === 'offered' && (
              <div style={{ marginTop: 8 }}>
                {onboard?.id === o.id ? (
                  <form onSubmit={accept}>
                    <div className="grid-2">
                      <Field label="Work email" required error={fieldErrors.work_email}>
                        <input type="email" value={onboard.work_email} onChange={(e) => setOnboard({ ...onboard, work_email: e.target.value })} autoFocus />
                      </Field>
                      <Field label="Date of joining">
                        <input type="date" value={onboard.date_of_joining} onChange={(e) => setOnboard({ ...onboard, date_of_joining: e.target.value })} />
                      </Field>
                    </div>
                    <button type="submit" className="btn" disabled={busy}>Create employee</button>{' '}
                    <button type="button" className="btn secondary" onClick={() => setOnboard(null)}>Cancel</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="btn small-btn"
                    onClick={() => setOnboard({ id: o.id, work_email: '', date_of_joining: o.expected_start_date || todayISO() })}
                  >
                    Accept and onboard
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {canManage && !closed && (
          <form onSubmit={sendOffer} style={{ marginTop: 12 }}>
            <div className="grid-2">
              <Field label="Yearly salary" required error={fieldErrors.base_annual_salary}>
                <input type="number" min="0" step="any" value={offer.base_annual_salary} onChange={setO('base_annual_salary')} />
              </Field>
              <Field label="Sign-on bonus" error={fieldErrors.sign_on_bonus}>
                <input type="number" min="0" step="any" value={offer.sign_on_bonus} onChange={setO('sign_on_bonus')} />
              </Field>
              <Field label="Currency" error={fieldErrors.currency}>
                <input type="text" maxLength={3} value={offer.currency} onChange={setO('currency')} />
              </Field>
              <Field label="Start date" required error={fieldErrors.expected_start_date}>
                <input type="date" value={offer.expected_start_date} onChange={setO('expected_start_date')} />
              </Field>
            </div>
            <Field label="Reason if outside the pay band" hint="Only needed when the salary is outside the position's band.">
              <input type="text" value={offer.out_of_band_reason} onChange={setO('out_of_band_reason')} />
            </Field>
            <button type="submit" className="btn secondary" disabled={busy}>Send offer</button>
          </form>
        )}
      </div>
    </Dialog>
  )
}
