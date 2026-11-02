import { useState } from 'react'
import { importWorkersFromUsers } from '../api.js'
import { todayISO } from '../utils.js'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'
import { SKIP_REASONS } from './ImportFromUsersModal.jsx'

// Only an active user of type Employee can have an employee record (People's import says the same).
export const canBecomeEmployee = (user) => user?.user_type === 'employee' && user?.status === 'active'

// Gives one user an employee record. Name, email, phone, team, manager and designation (their role in
// Identity) come from the user; only the joining date is asked for.
export default function MakeEmployeeDialog({ user, onClose, onDone }) {
  const [joined, setJoined] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const res = await importWorkersFromUsers([{ user_id: user.id, date_of_joining: joined }])
      const [skipped] = res?.skipped ?? []
      if (skipped) {
        setError(new Error(SKIP_REASONS[skipped.reason] || skipped.reason))
        return
      }
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      title={`Make ${user.name} an employee`}
      intro="Their name, email, phone, team, manager and designation (their role in Identity) come from this user. After this, People keeps those details and the employee record shows here, on their user page."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Make employee"
      savingLabel="Creating..."
      saving={saving}
      error={error}
    >
      <Field label="Date of joining" required hint="Past dates are fine for existing staff.">
        <input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} required autoFocus />
      </Field>
    </FormDialog>
  )
}
