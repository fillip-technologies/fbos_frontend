import { useState } from 'react'
import { customersApi } from '@/features/customers/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const EMPTY = { name: '', designation: '', email: '', phone: '', is_primary: false }

// A customer's contact people. Contacts can be added; the backend has no edit or delete yet.
export default function CustomerContacts({ orgId, customer, canManage, onAdded }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const contacts = customer.contacts || []

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { name: form.name.trim(), is_primary: form.is_primary }
      for (const k of ['designation', 'email', 'phone']) if (form[k].trim()) body[k] = form[k].trim()
      await customersApi.addContact(orgId, customer.id, body)
      setForm(null)
      onAdded()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="section-head">
        <p className="muted small" style={{ margin: 0 }}>The people you deal with at this customer.</p>
        {canManage && !form && (
          <button type="button" className="btn" onClick={() => setForm(EMPTY)}>+ Add contact</button>
        )}
      </div>

      {form && (
        <form className="inline-panel" onSubmit={handleSubmit} style={{ marginBottom: 14 }}>
          <h3>New contact</h3>
          {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="contact-name">Name *</label>
              <input id="contact-name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
              {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
            </div>
            <div className="field">
              <label htmlFor="contact-designation">Designation</label>
              <input
                id="contact-designation"
                maxLength={255}
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                type="email"
                maxLength={255}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
              {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
            </div>
            <div className="field">
              <label htmlFor="contact-phone">Phone</label>
              <input id="contact-phone" maxLength={50} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <label className="inline-check">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => set('is_primary', e.target.checked)} />
            Primary contact
          </label>
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add contact'}</button>
            <button type="button" className="btn secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Designation</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td colSpan={4} className="center-note">No contacts yet.</td></tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {c.is_primary && <span className="chip subtle" style={{ marginLeft: 8 }}>primary</span>}
                  </td>
                  <td>{c.designation || <span className="muted">—</span>}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="muted">—</span>}</td>
                  <td>{c.phone || <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
