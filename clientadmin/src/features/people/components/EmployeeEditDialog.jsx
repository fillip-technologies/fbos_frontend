import { useState } from 'react'
import { updateWorker } from '../api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const FIELDS = [
  'first_name', 'last_name', 'work_email', 'personal_email', 'phone', 'date_of_birth', 'gender', 'blood_group',
  'residential_address', 'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
  'job_title', 'employment_type', 'date_of_joining', 'probation_end_date', 'confirmation_date',
  'worker_code',
]

const toForm = (worker) => Object.fromEntries(FIELDS.map((f) => [f, worker[f] ?? '']))

// Edit an employee's profile: personal details, emergency contact and employment. ID numbers and
// bank accounts have their own tabs.
export default function EmployeeEditDialog({ worker, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(worker))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const original = toForm(worker)
    // Send only what changed; an emptied optional field is sent as null.
    const body = {}
    for (const field of FIELDS) {
      if (form[field] === original[field]) continue
      body[field] = typeof form[field] === 'string' && form[field].trim() === '' ? (field === 'worker_code' ? '' : null) : form[field]
    }
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }
    try {
      setSaving(true)
      setError(null)
      await updateWorker(worker.id, body)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const input = (name, label, props = {}, extra = {}) => (
    <Field label={label} error={fieldErrors[name]} {...extra}>
      <input type="text" value={form[name]} onChange={set(name)} {...props} />
    </Field>
  )

  return (
    <FormDialog wide title="Edit employee" onClose={onClose} onSubmit={handleSubmit} submitLabel="Save changes" saving={saving} error={error}>
      <h3 className="section-title" style={{ marginBottom: 10 }}>Personal</h3>
      <div className="grid-2">
        {input('first_name', 'First name', { required: true }, { required: true })}
        {input('last_name', 'Last name', {}, { required: true })}
        {input('work_email', 'Work email', { type: 'email' }, { required: true })}
        {input('personal_email', 'Personal email', { type: 'email' })}
        {input('phone', 'Phone', { type: 'tel' })}
        {input('date_of_birth', 'Date of birth', { type: 'date' })}
        <Field label="Gender" error={fieldErrors.gender}>
          <select value={form.gender} onChange={set('gender')}>
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        {input('blood_group', 'Blood group', { placeholder: 'e.g. O+' })}
        <Field label="Address" full error={fieldErrors.residential_address}>
          <textarea rows={2} value={form.residential_address} onChange={set('residential_address')} />
        </Field>
      </div>

      <h3 className="section-title" style={{ margin: '8px 0 10px' }}>Emergency contact</h3>
      <div className="grid-2">
        {input('emergency_contact_name', 'Name')}
        {input('emergency_contact_relation', 'Relation')}
        {input('emergency_contact_phone', 'Phone', { type: 'tel' })}
      </div>

      <h3 className="section-title" style={{ margin: '8px 0 10px' }}>Employment</h3>
      <div className="grid-2">
        {input('designation', 'Designation', { disabled: true, value: worker.designation }, { hint: 'Change it with Change role, so it is approved and recorded.' })}
        {input('job_title', 'Job title')}
        {input('worker_code', 'Employee code', {}, { hint: 'Optional. Must be unique.' })}
        <Field label="Employment type" error={fieldErrors.employment_type}>
          <select value={form.employment_type} onChange={set('employment_type')}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contractor">Contractor</option>
            <option value="intern">Intern</option>
          </select>
        </Field>
        {input('date_of_joining', 'Date of joining', { type: 'date' }, { required: true })}
        {input('probation_end_date', 'Probation ends', { type: 'date' })}
        {input('confirmation_date', 'Confirmed on', { type: 'date' })}
      </div>
    </FormDialog>
  )
}
