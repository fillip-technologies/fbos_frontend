import { useState } from 'react'
import { Link } from 'react-router-dom'
import { verticalsApi } from '@/features/verticals/api.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const codeFromName = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)

// The client's own verticals (industries). Nothing is predefined and no other client sees
// them. Branches and departments say which ones they work in (Company structure).
export default function VerticalsPanel({ orgId, verticals, canManage, onChanged }) {
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState(null) // vertical id
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

  const active = verticals.filter((v) => v.status === 'active')
  const archived = verticals.filter((v) => v.status !== 'active')

  return (
    <div className="panel role-card">
      <div className="section-head">
        <div>
          <h2>Verticals</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            The industries you work in, e.g. “Construction” or “Interior design”. They're private to your account; every pack belongs
            to one. Set which branches and departments work in each on <Link to="/org-units">Company structure</Link>.
          </p>
        </div>
        {canManage && !adding && <button className="btn secondary" onClick={() => setAdding(true)}>+ Add vertical</button>}
      </div>
      <ErrorBanner error={error} />

      {adding && (
        <VerticalForm
          onCancel={() => setAdding(false)}
          onSubmit={(body) => run(() => verticalsApi.create(orgId, body)).then((ok) => ok && setAdding(false))}
        />
      )}

      {verticals.length === 0 && !adding && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          No verticals yet.{canManage ? ' Add the first one to start building packs.' : ' Ask an administrator to add one.'}
        </p>
      )}

      <div className="vertical-list">
        {active.map((v) => (
          <div key={v.id} className="vertical-row">
            {renaming === v.id ? (
              <RenameForm
                vertical={v}
                onCancel={() => setRenaming(null)}
                onSubmit={(name) => run(() => verticalsApi.update(orgId, v.id, { name })).then((ok) => ok && setRenaming(null))}
              />
            ) : (
              <>
                <span><strong>{v.name}</strong> <span className="chip">{v.code}</span></span>
                {canManage && (
                  <span className="row-actions">
                    <button className="link-btn" onClick={() => setRenaming(v.id)}>Rename</button>
                    <button className="link-btn danger" onClick={() => run(() => verticalsApi.update(orgId, v.id, { status: 'archived' }))}>Archive</button>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
        {archived.map((v) => (
          <div key={v.id} className="vertical-row muted">
            <span>{v.name} <span className="badge archived">archived</span></span>
            {canManage && (
              <button className="link-btn" onClick={() => run(() => verticalsApi.update(orgId, v.id, { status: 'active' }))}>Restore</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function VerticalForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeEdited, setCodeEdited] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    await onSubmit({ name: name.trim(), code })
    setSaving(false)
  }

  return (
    <form className="grid-3" onSubmit={submit} style={{ marginBottom: 10 }}>
      <div className="field">
        <label htmlFor="v-name">Name *</label>
        <input id="v-name" value={name} required maxLength={255} placeholder="Construction"
          onChange={(e) => { setName(e.target.value); if (!codeEdited) setCode(codeFromName(e.target.value)) }} />
      </div>
      <div className="field">
        <label htmlFor="v-code">Code *</label>
        <input id="v-code" value={code} required maxLength={100} pattern="[a-z0-9][a-z0-9\-]*" placeholder="construction"
          onChange={(e) => { setCode(e.target.value); setCodeEdited(true) }} />
      </div>
      <div className="field row-actions">
        <button className="btn" type="submit" disabled={saving || !name.trim() || !code}>{saving ? 'Adding…' : 'Add'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function RenameForm({ vertical, onSubmit, onCancel }) {
  const [name, setName] = useState(vertical.name)
  return (
    <form className="row-actions" onSubmit={(e) => { e.preventDefault(); onSubmit(name.trim()) }}>
      <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} aria-label="Vertical name" />
      <button className="btn small-btn" type="submit" disabled={!name.trim()}>Save</button>
      <button className="btn secondary small-btn" type="button" onClick={onCancel}>Cancel</button>
    </form>
  )
}
