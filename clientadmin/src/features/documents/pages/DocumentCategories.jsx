import { useState } from 'react'
import { documentCategoriesApi, formatFileSize } from '@/features/documents/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'

const CLASSIFICATIONS = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted (never shared outside)',
}

const MB = 1024 * 1024

const toForm = (category) => ({
  code: category?.code ?? '',
  name: category?.name ?? '',
  default_classification: category?.default_classification ?? 'internal',
  allowed_mime_types: (category?.allowed_mime_types ?? []).join(', '),
  max_mb: category?.max_file_size_bytes ? String(category.max_file_size_bytes / MB) : '',
})

// Form values -> request body. The code is only sent when creating: it can't change.
function toBody(form, creating) {
  const body = {
    name: form.name.trim(),
    default_classification: form.default_classification,
    allowed_mime_types: form.allowed_mime_types.split(',').map((m) => m.trim()).filter(Boolean),
    max_file_size_bytes: form.max_mb ? Math.round(Number(form.max_mb) * MB) : null,
  }
  return creating ? { code: form.code.trim(), ...body } : body
}

function CategoryForm({ orgId, category, onSaved, onCancel }) {
  const creating = !category
  const [form, setForm] = useState(() => toForm(category))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  if (error?.code === 'CATEGORY_CODE_EXISTS') fieldErrors.code = friendlyMessage(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = toBody(form, creating)
      if (creating) await documentCategoriesApi.create(orgId, body)
      else await documentCategoriesApi.update(orgId, category.id, body)
      onSaved()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit} style={{ marginTop: 0, marginBottom: 14 }}>
      <h3>{creating ? 'New category' : `Edit “${category.name}”`}</h3>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="cat-name">Name *</label>
          <input id="cat-name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="cat-code">Code *</label>
          <input
            id="cat-code"
            className="mono-input"
            required
            maxLength={100}
            pattern="[a-z0-9][a-z0-9_\-]*"
            disabled={!creating}
            value={form.code}
            onChange={(e) => set('code', e.target.value.toLowerCase())}
          />
          <div className="hint">{creating ? 'Lowercase letters, digits, - and _. Can’t change later.' : 'Can’t change.'}</div>
          {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
        </div>
        <div className="field">
          <label htmlFor="cat-class">Default classification</label>
          <select
            id="cat-class"
            value={form.default_classification}
            onChange={(e) => set('default_classification', e.target.value)}
          >
            {Object.entries(CLASSIFICATIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="cat-mime">Allowed file types</label>
          <input
            id="cat-mime"
            className="mono-input"
            placeholder="application/pdf, image/png"
            value={form.allowed_mime_types}
            onChange={(e) => set('allowed_mime_types', e.target.value)}
          />
          <div className="hint">MIME types, comma separated. Empty accepts any file.</div>
        </div>
        <div className="field">
          <label htmlFor="cat-max">Largest file (MB)</label>
          <input
            id="cat-max"
            type="number"
            min="0.1"
            max="100"
            step="any"
            value={form.max_mb}
            onChange={(e) => set('max_mb', e.target.value)}
          />
          <div className="hint">Empty means the 100 MB service limit.</div>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : creating ? 'Add category' : 'Save'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

// The organization's document categories: every upload is filed under one of them, and a
// category sets the file's default classification and its size / type limits.
export default function DocumentCategories() {
  const { orgId, activeOrg } = useActiveOrg()
  const { data, error, loading, reload } = useLookup(
    ['document-categories', orgId],
    ({ signal }) => documentCategoriesApi.list(orgId, { signal }),
    { enabled: Boolean(orgId) },
  )
  const categories = data?.data ?? []
  const [editing, setEditing] = useState(null) // 'new' | category

  const saved = () => {
    setEditing(null)
    invalidate(['document-categories', orgId])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Document categories</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            How files attached to records in {activeOrg ? `“${activeOrg.name}”` : 'this company'} are filed: each upload
            picks one, which sets its classification and the size and file types allowed.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setEditing(null)} />
          {!editing && <button className="btn" onClick={() => setEditing('new')}>+ New category</button>}
        </div>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      {editing && (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          orgId={orgId}
          category={editing === 'new' ? null : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Classification</th>
              <th>File types</th>
              <th>Largest file</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={5} />
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="center-note">No categories yet.</td></tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="muted small mono">{c.code}</div>
                  </td>
                  <td>{CLASSIFICATIONS[c.default_classification] || c.default_classification}</td>
                  <td className="small">
                    {c.allowed_mime_types.length ? c.allowed_mime_types.join(', ') : <span className="muted">Any</span>}
                  </td>
                  <td>{c.max_file_size_bytes ? formatFileSize(c.max_file_size_bytes) : <span className="muted">100 MB</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="link-btn" onClick={() => setEditing(c)}>Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
