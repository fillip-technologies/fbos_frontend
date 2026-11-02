import { useState } from 'react'
import { createCandidate } from '../api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', linkedin_url: '', source: 'career_site', tags: '' }
export const SOURCES = ['career_site', 'referral', 'linkedin', 'agency', 'walk_in', 'other']

// Adds a candidate to the talent pool. `onCreated(candidate)` runs after it is saved.
export default function CandidateDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const candidate = await createCandidate({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        source: form.source,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      onCreated(candidate)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog title="Add candidate" onClose={onClose} onSubmit={submit} submitLabel="Add candidate" savingLabel="Adding..." saving={saving} error={error} wide>
      <div className="grid-2">
        <Field label="First name" required error={fieldErrors.first_name}>
          <input type="text" value={form.first_name} onChange={set('first_name')} autoFocus />
        </Field>
        <Field label="Last name" required error={fieldErrors.last_name}>
          <input type="text" value={form.last_name} onChange={set('last_name')} />
        </Field>
        <Field label="Email" required error={fieldErrors.email}>
          <input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone" error={fieldErrors.phone}>
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="LinkedIn" error={fieldErrors.linkedin_url}>
          <input type="url" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/..." />
        </Field>
        <Field label="Source" error={fieldErrors.source}>
          <select value={form.source} onChange={set('source')}>
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Tags" hint="Comma separated, e.g. python, backend" error={fieldErrors.tags}>
        <input type="text" value={form.tags} onChange={set('tags')} />
      </Field>
    </FormDialog>
  )
}
