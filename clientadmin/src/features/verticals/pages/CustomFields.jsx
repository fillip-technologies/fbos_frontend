import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { customFieldsApi, verticalPacksApi, verticalsApi } from '@/features/verticals/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import FieldRowsEditor, { blankField } from '@/features/verticals/components/FieldRowsEditor.jsx'
import { buildSchema, describeSchema, fieldError } from '@/features/verticals/utils.js'

// Custom fields: extra fields a company adds to a business object (work units, deals,
// invoices…). Each definition is a JSON Schema for one object type, created as a draft and
// then published, or installed by a vertical pack. The backend has no edit or delete, so a
// change means a new definition; a pack update retires the definition it replaces.
const STATUS_FILTERS = [
  { value: '', label: 'Live and drafts' },
  { value: 'published', label: 'Live only' },
  { value: 'draft', label: 'Drafts only' },
  { value: 'retired', label: 'Retired' },
]
export default function CustomFields() {
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canCreate = hasAccess(user, ACCESS.createCustomFields)
  const canPublish = hasAccess(user, ACCESS.publishCustomFields)

  const [definitions, setDefinitions] = useState([])
  const [objectTypes, setObjectTypes] = useState([])
  const [verticals, setVerticals] = useState([])
  const [packs, setPacks] = useState([])
  const [objectType, setObjectType] = useState('') // list filter; '' = all
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    Promise.all([
      customFieldsApi.list(orgId, { object_type: objectType, status }),
      verticalsApi.objectTypes(orgId),
      verticalsApi.list(orgId).catch(() => []),
      // Only to name the pack a definition came from; not everyone may read packs.
      verticalPacksApi.list(orgId).catch(() => []),
    ])
      .then(([defs, types, verts, packList]) => {
        // Retired definitions were replaced by a pack update; show them only when asked.
        setDefinitions(status ? defs : defs.filter((d) => d.status !== 'retired'))
        setObjectTypes(types)
        setVerticals(verts)
        setPacks(packList)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, objectType, status])
  useEffect(load, [load])

  const typeName = useMemo(() => Object.fromEntries(objectTypes.map((t) => [t.code, t.display_name])), [objectTypes])
  const verticalName = useMemo(() => Object.fromEntries(verticals.map((v) => [v.id, v.name])), [verticals])
  const packName = useMemo(() => Object.fromEntries(packs.map((p) => [p.id, p.name])), [packs])

  const done = (message) => {
    setCreating(false)
    setNotice(message)
    load()
  }

  async function publish(def) {
    const name = typeName[def.object_type] || def.object_type
    if (!window.confirm(`Publish these custom fields for ${name}? Once published they can't be changed.`)) return
    setError(null)
    setNotice('')
    setPublishing(def.id)
    try {
      await customFieldsApi.publish(orgId, def.id, def.version_no)
      done(`Custom fields for ${name} published.`)
    } catch (err) {
      setError(err)
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Custom fields</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Extra fields {activeOrg ? `“${activeOrg.name}”` : 'this company'} records on work units, deals, invoices and other
            records. Start a draft, check it, then publish it to make the fields live.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setCreating(false)} />
          {canCreate && <button className="btn" onClick={() => setCreating(true)} disabled={creating}>+ New custom fields</button>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={load} />

      {creating && (
        <DefinitionForm
          orgId={orgId}
          objectTypes={objectTypes}
          verticals={verticals.filter((v) => v.status === 'active')}
          defaultObjectType={objectType}
          onCancel={() => setCreating(false)}
          onSaved={(d) => done(`Draft for ${typeName[d.object_type] || d.object_type} saved. Publish it when it's ready.`)}
        />
      )}

      <div className="toolbar">
        <label className="muted small" htmlFor="cf-filter">Record type</label>
        <select id="cf-filter" value={objectType} onChange={(e) => setObjectType(e.target.value)}>
          <option value="">All record types</option>
          {objectTypes.map((t) => <option key={t.code} value={t.code}>{t.display_name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="center-note">Loading…</div>
      ) : definitions.length === 0 ? (
        <div className="panel empty-state">
          <h2>No custom fields{objectType ? ` for ${typeName[objectType] || objectType}` : ''}</h2>
          <p className="muted">Add fields your team needs to fill in, such as a contract tier or a site code, then publish them.</p>
          {canCreate && !creating && <button className="btn" onClick={() => setCreating(true)}>+ New custom fields</button>}
        </div>
      ) : (
        definitions.map((def) => {
          const fields = describeSchema(def.json_schema, def.ui_schema)
          return (
            <div key={def.id} className="panel role-card">
              <div className="section-head">
                <div>
                  <h2>{typeName[def.object_type] || def.object_type} <StatusBadge status={def.status} /></h2>
                  <p className="muted small" style={{ margin: '2px 0 0' }}>
                    {def.vertical_id ? (verticalName[def.vertical_id] || 'One vertical') : 'All verticals'} · version {def.version_no} ·{' '}
                    {fields.length} field{fields.length === 1 ? '' : 's'}
                    {def.source_pack_id && (
                      <> · from pack <Link to={`/vertical-packs/${def.source_pack_id}`}>{packName[def.source_pack_id] || 'a vertical pack'}</Link> v{def.source_pack_version}</>
                    )}
                  </p>
                </div>
                {canPublish && def.status === 'draft' && (
                  <div className="row-actions">
                    <button className="btn secondary" onClick={() => publish(def)} disabled={publishing === def.id}>
                      {publishing === def.id ? 'Publishing…' : 'Publish'}
                    </button>
                  </div>
                )}
              </div>
              {fields.length === 0 ? (
                <p className="muted small" style={{ marginBottom: 0 }}>No fields in this schema.</p>
              ) : (
                <table className="compact">
                  <thead>
                    <tr><th>Field</th><th>Key</th><th>Type</th><th style={{ width: 90 }}>Required</th></tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f.key}>
                        <td>{f.title}</td>
                        <td><span className="chip">{f.key}</span></td>
                        <td>{f.description}</td>
                        <td>{f.required ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function DefinitionForm({ orgId, objectTypes, verticals, defaultObjectType, onCancel, onSaved }) {
  const [objectType, setObjectType] = useState(defaultObjectType || objectTypes[0]?.code || '')
  const [verticalId, setVerticalId] = useState('')
  const [fields, setFields] = useState(() => [blankField()])
  const [showJson, setShowJson] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const errors = Object.fromEntries(fields.map((f) => [f.rowKey, fieldError(f, fields)]))
  const hasErrors = Object.values(errors).some(Boolean)
  const payload = useMemo(() => buildSchema(fields), [fields])


  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const body = { object_type: objectType, ...payload }
    if (verticalId) body.vertical_id = verticalId
    try {
      onSaved(await customFieldsApi.create(orgId, body))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel role-card editing" onSubmit={submit}>
      <h2>New custom fields</h2>
      <div className="alert info">This saves a draft. Drafts and published fields can't be edited later; to change them, create a new set.</div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="cf-type">Record type *</label>
          <select id="cf-type" value={objectType} onChange={(e) => setObjectType(e.target.value)} required>
            {objectTypes.map((t) => <option key={t.code} value={t.code}>{t.display_name}</option>)}
          </select>
          {fieldErrors.object_type && <div className="field-error">{fieldErrors.object_type}</div>}
        </div>
        <div className="field">
          <label htmlFor="cf-vertical">Vertical</label>
          <select id="cf-vertical" value={verticalId} onChange={(e) => setVerticalId(e.target.value)}>
            <option value="">All verticals</option>
            {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="hint">Limit these fields to records of one industry vertical, or leave them for all.</div>
        </div>
      </div>

      <div className="field">
        <label>Fields *</label>
        <FieldRowsEditor fields={fields} onChange={setFields} errors={errors} idPrefix="cf" />
        <div className="hint">The key is how other systems and reports refer to the field; it can't be changed once published.</div>
        {fieldErrors.json_schema && <div className="field-error">{fieldErrors.json_schema}</div>}
      </div>

      <button type="button" className="link-btn" onClick={() => setShowJson((s) => !s)} style={{ marginBottom: 10 }}>
        {showJson ? 'Hide' : 'Show'} the JSON Schema that will be saved
      </button>
      {showJson && <pre className="json-preview">{JSON.stringify(payload, null, 2)}</pre>}

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || hasErrors || !objectType}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && Object.keys(fieldErrors).length > 0 && <div className="field-error">{friendlyMessage(error)}</div>}
    </form>
  )
}
