import { useState } from 'react'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { planningApi } from '@/features/management/api.js'
import { BAND_LABELS, RAG_LABELS } from '@/features/management/utils.js'

export const RagBadge = ({ rag }) => (rag ? <StatusBadge status={rag} label={RAG_LABELS[rag]} /> : <span className="muted">—</span>)

// The owner's own word on a goal, next to the computed score: confidence is forward-looking,
// the score is what already happened.
export function CheckInDialog({ orgId, goal, onClose, onSaved }) {
  const [confidence, setConfidence] = useState('0.7')
  const [rag, setRag] = useState('green')
  const [narrative, setNarrative] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await planningApi.checkIn(orgId, goal.goal_id ?? goal.id, { confidence: Number(confidence), rag, narrative: narrative.trim() })
      onSaved()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title={`Check in: ${goal.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="ci-confidence">How confident are you of reaching it? (0 to 1)</label>
          <input id="ci-confidence" type="number" min="0" max="1" step="0.05" value={confidence} onChange={(e) => setConfidence(e.target.value)} required />
          <div className="hint">
            {Number(confidence) >= 0.7 ? BAND_LABELS.confident : Number(confidence) >= 0.4 ? BAND_LABELS.at_risk : BAND_LABELS.change_approach}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ci-rag">Your colour</label>
          <select id="ci-rag" value={rag} onChange={(e) => setRag(e.target.value)}>
            {Object.entries(RAG_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ci-narrative">What is the story behind it?</label>
          <input id="ci-narrative" value={narrative} onChange={(e) => setNarrative(e.target.value)} required />
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving || !narrative.trim()}>{saving ? 'Saving…' : 'Save check-in'}</button>
        </div>
      </form>
    </Dialog>
  )
}
