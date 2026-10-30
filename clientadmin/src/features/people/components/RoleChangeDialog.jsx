import { useEffect, useState } from 'react'
import { getPositions, getWorkers, requestRoleChange } from '../api.js'
import { formatCurrency, statusLabel, toList, todayISO } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const TYPES = [
  ['promotion', 'Promotion'],
  ['demotion', 'Demotion'],
  ['transfer', 'Transfer (same level, new team or manager)'],
  ['correction', 'Correction (fix a wrong title or reporting line)'],
]

// Ask for a promotion, demotion, transfer or correction. Another person approves it before anything changes.
export default function RoleChangeDialog({ worker, salary, units, onClose, onSaved }) {
  const [form, setForm] = useState({
    change_type: 'promotion',
    effective_date: todayISO(),
    reason: '',
    new_designation: '',
    new_unit_id: null,
    new_manager_id: '',
    new_position_id: '',
    new_annual_ctc: '',
  })
  const [workers, setWorkers] = useState([])
  const [positions, setPositions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    getWorkers({ limit: 100 }).then((res) => setWorkers(toList(res).filter((w) => w.id !== worker.id && w.status !== 'exited'))).catch(() => {})
    getPositions({ hiring_status: 'vacant', limit: 100 }).then((res) => setPositions(toList(res))).catch(() => {})
  }, [worker.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const body = { change_type: form.change_type, effective_date: form.effective_date, reason: form.reason.trim() }
    if (form.new_designation.trim()) body.new_designation = form.new_designation.trim()
    if (form.new_unit_id) body.new_unit_id = form.new_unit_id
    if (form.new_manager_id) body.new_manager_id = form.new_manager_id
    if (form.new_position_id) body.new_position_id = form.new_position_id
    if (form.new_annual_ctc !== '') body.new_annual_ctc = Number(form.new_annual_ctc)
    try {
      setSaving(true)
      setError(null)
      await requestRoleChange(worker.id, body)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const future = form.effective_date > todayISO()
  return (
    <FormDialog
      wide
      title={`Change role: ${worker.name || `${worker.first_name} ${worker.last_name}`}`}
      intro={`Fill in only what changes. Someone else must approve it; ${future ? 'it then applies on the effective date' : 'a past or current date applies as soon as it is approved'}.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Send for approval"
      savingLabel="Sending..."
      saving={saving}
      error={error}
    >
      <div className="grid-2">
        <Field label="Type" error={fieldErrors.change_type}>
          <select value={form.change_type} onChange={(e) => set({ change_type: e.target.value })}>
            {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Effective date" required hint="Past dates are fine." error={fieldErrors.effective_date}>
          <input type="date" value={form.effective_date} onChange={(e) => set({ effective_date: e.target.value })} />
        </Field>
        <Field label="New designation" hint={`Now: ${worker.designation}`} error={fieldErrors.new_designation}>
          <input type="text" value={form.new_designation} onChange={(e) => set({ new_designation: e.target.value })} />
        </Field>
        {units?.length > 0 && (
          <div className="field">
            <label htmlFor="rc-unit">New department</label>
            <UnitSelect id="rc-unit" units={units} value={form.new_unit_id} onChange={(v) => set({ new_unit_id: v })} emptyLabel="No change" />
            {fieldErrors.new_unit_id && <div className="field-error">{fieldErrors.new_unit_id}</div>}
          </div>
        )}
        <Field label="New manager" error={fieldErrors.new_manager_id}>
          <select value={form.new_manager_id} onChange={(e) => set({ new_manager_id: e.target.value })}>
            <option value="">No change</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.worker_code ? `${w.worker_code} - ` : ''}{w.first_name} {w.last_name}</option>
            ))}
          </select>
        </Field>
        <Field label="New position seat" hint="Only vacant seats. The old seat becomes vacant." error={fieldErrors.new_position_id}>
          <select value={form.new_position_id} onChange={(e) => set({ new_position_id: e.target.value })}>
            <option value="">No change</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.position_code} - {p.title} ({statusLabel(p.hiring_status)})</option>
            ))}
          </select>
        </Field>
        {salary && (
          <Field
            label={`New annual package (${salary.currency})`}
            hint={`Now ${formatCurrency(salary.annual_ctc, salary.currency)}. ${form.change_type === 'promotion' ? 'A promotion cannot reduce it.' : form.change_type === 'demotion' ? 'A demotion cannot increase it.' : ''}`}
            error={fieldErrors.new_annual_ctc}
          >
            <input type="number" min="0" step="1000" value={form.new_annual_ctc} onChange={(e) => set({ new_annual_ctc: e.target.value })} />
          </Field>
        )}
      </div>
      <Field label="Reason" required error={fieldErrors.reason} full>
        <textarea rows={3} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Why is this change being made?" />
      </Field>
    </FormDialog>
  )
}
