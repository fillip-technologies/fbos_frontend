import { useState } from 'react'
import { categoriesApi, providersApi } from '@/features/customers/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import useServiceCatalog from '@/features/customers/useServiceCatalog.js'
import { changedFields } from '@/features/customers/utils.js'

const PROVIDER_FIELDS = ['name', 'category_id', 'contact_name', 'phone', 'email', 'website', 'notes']
const providerToForm = (p) => Object.fromEntries(PROVIDER_FIELDS.map((k) => [k, (k === 'category_id' ? p?.category?.id : p?.[k]) || '']))
// Blank optional fields are sent as null so an edit can clear them.
const providerFromForm = (f) =>
  Object.fromEntries(PROVIDER_FIELDS.map((k) => [k, f[k].trim() === '' && k !== 'name' ? null : f[k].trim()]))

// Websites are typed by hand ("acme.com"); only http(s) links are rendered as such.
const webHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

function ProviderForm({ provider, categories, onSave, onCancel }) {
  const [form, setForm] = useState(() => providerToForm(provider))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = providerFromForm(form)
      await onSave(provider ? changedFields(providerFromForm(providerToForm(provider)), body) : body)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const input = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`provider-${k}`}>{label}</label>
      <input id={`provider-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
      {fieldErrors[k] && <div className="field-error">{fieldErrors[k]}</div>}
    </div>
  )

  return (
    <form className="inline-panel" onSubmit={handleSubmit} style={{ marginBottom: 14 }}>
      <h3>{provider ? `Edit “${provider.name}”` : 'New provider'}</h3>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-2">
        {input('name', 'Name *', { required: true, maxLength: 255, placeholder: 'e.g. Airtel, GoDaddy, LIC' })}
        <div className="field">
          <label htmlFor="provider-category_id">Usual category</label>
          <select id="provider-category_id" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">—</option>
            {categories
              .filter((c) => c.is_active || c.id === form.category_id)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
          <div className="hint">New services from this provider start in it.</div>
        </div>
      </div>
      <div className="grid-3">
        {input('contact_name', 'Contact person', { maxLength: 255 })}
        {input('phone', 'Phone', { maxLength: 50 })}
        {input('email', 'Email', { type: 'email', maxLength: 255 })}
      </div>
      {input('website', 'Website', { maxLength: 512, placeholder: 'https://' })}
      <div className="field">
        <label htmlFor="provider-notes">Notes</label>
        <textarea id="provider-notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : provider ? 'Save changes' : 'Add provider'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

function Categories({ orgId, categories, canManage, onChanged }) {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(null) // { id, name }
  const [error, setError] = useState(null)

  async function run(action) {
    setError(null)
    try {
      await action()
      onChanged()
      return true
    } catch (err) {
      setError(err)
      return false
    }
  }

  async function add(e) {
    e.preventDefault()
    if (await run(() => categoriesApi.create(orgId, { name: name.trim() }))) setName('')
  }

  async function rename(e) {
    e.preventDefault()
    if (await run(() => categoriesApi.update(orgId, renaming.id, { name: renaming.name.trim() }))) setRenaming(null)
  }

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: 17 }}>Categories</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Group services for filtering. A deactivated category stays on existing services but can't be picked for new ones.
          </p>
        </div>
      </div>
      <ErrorBanner error={error} />
      <table>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} style={{ cursor: 'default' }}>
              <td>
                {renaming?.id === c.id ? (
                  <form onSubmit={rename} style={{ display: 'flex', gap: 6 }}>
                    <input
                      required
                      maxLength={100}
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      aria-label="Category name"
                    />
                    <button className="btn small-btn" type="submit">Save</button>
                    <button type="button" className="btn secondary small-btn" onClick={() => setRenaming(null)}>Cancel</button>
                  </form>
                ) : (
                  <span className={c.is_active ? '' : 'muted'}>{c.name}</span>
                )}
              </td>
              <td>{!c.is_active && <span className="badge inactive">inactive</span>}</td>
              {canManage && (
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {renaming?.id !== c.id && (
                    <button type="button" className="btn secondary small-btn" onClick={() => setRenaming({ id: c.id, name: c.name })}>
                      Rename
                    </button>
                  )}{' '}
                  <button
                    type="button"
                    className="btn secondary small-btn"
                    onClick={() => run(() => categoriesApi.update(orgId, c.id, { is_active: !c.is_active }))}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canManage && (
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input required maxLength={100} placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" type="submit">Add</button>
        </form>
      )}
    </div>
  )
}

export default function ServiceProviders() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const catalog = useServiceCatalog(orgId)
  const canManage = hasAccess(me, ACCESS.manageClientServices)
  // null: no form; 'new': adding; a provider: editing it.
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState(null)

  async function save(body) {
    if (editing === 'new') await providersApi.create(orgId, body)
    else if (Object.keys(body).length) await providersApi.update(orgId, editing.id, editing.version, body)
    setEditing(null)
    catalog.reload()
  }

  async function remove(provider) {
    if (!window.confirm(`Delete “${provider.name}”?`)) return
    setError(null)
    try {
      await providersApi.remove(orgId, provider.id)
      catalog.reload()
    } catch (err) {
      setError(err)
    }
  }

  const needle = q.trim().toLowerCase()
  const providers = needle ? catalog.providers.filter((p) => p.name.toLowerCase().includes(needle)) : catalog.providers

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Service providers</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The companies that supply your customers' outside services, and the categories they fall into.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setEditing(null)} />
          {canManage && !editing && <button className="btn" onClick={() => setEditing('new')}>+ New provider</button>}
        </div>
      </div>

      <ErrorBanner error={error || catalog.error} onRetry={catalog.reload} />
      {editing && (
        <ProviderForm
          key={editing === 'new' ? 'new' : editing.id}
          provider={editing === 'new' ? null : editing}
          categories={catalog.categories}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="toolbar">
        <input placeholder="Search providers" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
      </div>
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Category</th>
              <th>Contact</th>
              <th>Website</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {catalog.loading ? (
              <tr><td colSpan={5} className="center-note">Loading…</td></tr>
            ) : providers.length === 0 ? (
              <tr><td colSpan={5} className="center-note">No providers yet.</td></tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.notes && <div className="muted small">{p.notes}</div>}
                  </td>
                  <td>{p.category?.name || <span className="muted">—</span>}</td>
                  <td>
                    {p.contact_name || <span className="muted">—</span>}
                    {(p.phone || p.email) && <div className="muted small">{[p.phone, p.email].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td>
                    {p.website ? (
                      <a href={webHref(p.website)} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\//, '')}</a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {canManage && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn secondary small-btn" onClick={() => setEditing(p)}>Edit</button>{' '}
                      <button type="button" className="btn danger-outline small-btn" onClick={() => remove(p)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <Categories orgId={orgId} categories={catalog.categories} canManage={canManage} onChanged={catalog.reload} />
      </div>
    </div>
  )
}
