import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { verticalPacksApi, verticalsApi } from '@/features/verticals/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import FieldRowsEditor, { blankField } from '@/features/verticals/components/FieldRowsEditor.jsx'
import InstallPanel from '@/features/verticals/components/InstallPanel.jsx'
import VerticalUnits from '@/features/verticals/components/VerticalUnits.jsx'
import { describePackField, fieldError, toEditorRows, toPackFields } from '@/features/verticals/utils.js'
import { formatDate } from '@/shared/utils/format.js'

// Design one pack: its details, its versions, and the content of the current draft.
// A published version is read-only; changes go into the next draft.
export default function PackDesigner() {
  const { id } = useParams()
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canDesign = hasAccess(user, ACCESS.designPacks)
  const canInstall = hasAccess(user, ACCESS.installPacks)
  const canAssignUnits = hasAccess(user, ACCESS.updateOrgUnit)

  const [pack, setPack] = useState(null)
  const [verticals, setVerticals] = useState([])
  const [objectTypes, setObjectTypes] = useState([])
  const [selected, setSelected] = useState(null) // version_no
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [editingDetails, setEditingDetails] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [busy, setBusy] = useState(false)

  const show = useCallback((p, versionNo) => {
    setPack(p)
    setSelected(versionNo ?? p.draft_version ?? p.latest_published_version ?? p.versions[p.versions.length - 1]?.version_no)
  }, [])

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    Promise.all([verticalPacksApi.get(orgId, id), verticalsApi.list(orgId), verticalsApi.objectTypes(orgId)])
      .then(([p, v, t]) => {
        show(p)
        setVerticals(v)
        setObjectTypes(t)
      })
      .catch(setError)
  }, [orgId, id, show])
  useEffect(load, [load])

  const typeName = useMemo(() => Object.fromEntries(objectTypes.map((t) => [t.code, t.display_name])), [objectTypes])

  async function act(action, message) {
    setError(null)
    setNotice('')
    setBusy(true)
    try {
      const result = await action()
      if (message) setNotice(message)
      return result
    } catch (err) {
      setError(err)
      return null
    } finally {
      setBusy(false)
    }
  }

  if (!pack) {
    return error ? <ErrorBanner error={error} onRetry={load} /> : <div className="center-note">Loading…</div>
  }

  const version = pack.versions.find((v) => v.version_no === selected)
  const isDraft = version?.status === 'draft'
  const installedVersion = pack.installation?.version_no
  const companyName = activeOrg ? `“${activeOrg.name}”` : 'this company'

  const startNewVersion = () =>
    act(() => verticalPacksApi.newVersion(orgId, pack.id), 'New draft started from the latest version.').then(
      (p) => p && show(p, p.draft_version)
    )

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="small"><Link to="/vertical-packs">← Vertical packs</Link></div>
          <h1>{pack.name} <span className="chip">{pack.code}</span></h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {pack.vertical.name}{pack.description ? ` · ${pack.description}` : ''}
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setInstalling(false)} />
          {canDesign && !editingDetails && <button className="btn secondary" onClick={() => setEditingDetails(true)}>Edit details</button>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={load} />

      {editingDetails && (
        <DetailsForm
          pack={pack}
          verticals={verticals.filter((v) => v.status === 'active' || v.id === pack.vertical.id)}
          onCancel={() => setEditingDetails(false)}
          onSave={(body) =>
            act(() => verticalPacksApi.update(orgId, pack.id, body), 'Pack details saved.').then((p) => {
              if (!p) return
              show(p, selected)
              setEditingDetails(false)
            })
          }
        />
      )}

      <div className="panel role-card">
        <div className="section-head">
          <div>
            <h2>In {companyName}</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              {installedVersion
                ? `Version ${installedVersion} installed on ${formatDate(pack.installation.installed_at.slice(0, 10))}.`
                : 'Not installed in this company yet.'}
              {installedVersion && pack.latest_published_version > installedVersion && ` Version ${pack.latest_published_version} is available.`}
            </p>
          </div>
          {canInstall && pack.latest_published_version && !installing && (
            <button className="btn" onClick={() => { setNotice(''); setInstalling(true) }}>
              {installedVersion ? 'Change installed version' : 'Install'}
            </button>
          )}
        </div>
        {installing && (
          <InstallPanel
            orgId={orgId}
            pack={pack}
            companyName={companyName}
            typeName={typeName}
            onCancel={() => setInstalling(false)}
            onInstalled={(installation) => {
              setInstalling(false)
              setNotice(`Version ${installation.version_no} is installed in ${companyName}.`)
              load()
            }}
          />
        )}
      </div>

      <VerticalUnits key={orgId} orgId={orgId} vertical={pack.vertical} companyName={companyName} canAssign={canAssignUnits} />

      <div className="version-tabs" role="tablist" aria-label="Versions">
        {pack.versions.map((v) => (
          <button
            key={v.version_no}
            role="tab"
            aria-selected={v.version_no === selected}
            className={`version-tab${v.version_no === selected ? ' active' : ''}`}
            onClick={() => setSelected(v.version_no)}
          >
            Version {v.version_no} <StatusBadge status={v.status} />
            {v.version_no === installedVersion && <span className="muted small"> · installed here</span>}
          </button>
        ))}
        {canDesign && !pack.draft_version && (
          <button className="link-btn" onClick={startNewVersion} disabled={busy}>+ New version</button>
        )}
      </div>

      {version && (isDraft && canDesign ? (
        <DraftEditor
          key={`${version.version_no}-${version.revision}`}
          version={version}
          objectTypes={objectTypes}
          typeName={typeName}
          busy={busy}
          onSave={(content) =>
            act(() => verticalPacksApi.saveDraft(orgId, pack.id, version.version_no, version.revision, content), 'Draft saved.')
              .then((p) => p && show(p, version.version_no))
          }
          onPublish={() => {
            if (!window.confirm(`Publish version ${version.version_no}? It can't be changed afterwards; later changes go into a new version.`)) return
            act(() => verticalPacksApi.publish(orgId, pack.id, version.version_no, version.revision),
              `Version ${version.version_no} published. Install it in each company that should use it.`)
              .then((p) => p && show(p, version.version_no))
          }}
        />
      ) : (
        <div className="panel role-card">
          <div className="section-head">
            <p className="muted small" style={{ margin: 0 }}>
              {isDraft
                ? 'This draft is still being designed.'
                : `Published${version.published_at ? ` on ${formatDate(version.published_at.slice(0, 10))}` : ''}. Published versions can't be changed.`}
            </p>
            {canDesign && !isDraft && !pack.draft_version && (
              <button className="btn secondary" onClick={startNewVersion} disabled={busy}>Start version {Math.max(...pack.versions.map((v) => v.version_no)) + 1}</button>
            )}
          </div>
          <SectionsView sections={version.content.sections} typeName={typeName} />
        </div>
      ))}
    </div>
  )
}

function SectionsView({ sections, typeName }) {
  if (!sections.length) return <p className="muted small" style={{ marginBottom: 0 }}>No sections.</p>
  return sections.map((section) => (
    <div key={section.object_type} className="pack-section">
      <h3>Custom fields on {typeName[section.object_type] || section.object_type}</h3>
      <table className="compact">
        <thead>
          <tr><th>Field</th><th>Key</th><th>Type</th><th style={{ width: 90 }}>Required</th></tr>
        </thead>
        <tbody>
          {section.fields.map(describePackField).map((f) => (
            <tr key={f.key}>
              <td>{f.title}</td>
              <td><span className="chip">{f.key}</span></td>
              <td>{f.description}</td>
              <td>{f.required ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))
}

let sectionKey = 1
const toEditorSections = (content) =>
  content.sections.map((s) => ({ sectionKey: sectionKey++, object_type: s.object_type, rows: toEditorRows(s.fields, blankField) }))
const toContent = (sections) => ({
  sections: sections.map((s) => ({ type: 'custom_fields', object_type: s.object_type, fields: toPackFields(s.rows) })),
})

function DraftEditor({ version, objectTypes, typeName, busy, onSave, onPublish }) {
  const [sections, setSections] = useState(() => toEditorSections(version.content))
  const [adding, setAdding] = useState('')

  const content = toContent(sections)
  // The editor emits sections in the same shape (and key order) the server returns.
  const dirty = JSON.stringify(content) !== JSON.stringify(version.content)
  const errors = Object.fromEntries(sections.flatMap((s) => s.rows.map((r) => [r.rowKey, fieldError(r, s.rows)])))
  const hasErrors = Object.values(errors).some(Boolean) || sections.some((s) => !s.rows.length)
  const used = new Set(sections.map((s) => s.object_type))
  const available = objectTypes.filter((t) => !used.has(t.code))

  const setRows = (key, rows) => setSections((ss) => ss.map((s) => (s.sectionKey === key ? { ...s, rows } : s)))
  const removeSection = (key) => setSections((ss) => ss.filter((s) => s.sectionKey !== key))
  const addSection = () => {
    if (!adding) return
    setSections((ss) => [...ss, { sectionKey: sectionKey++, object_type: adding, rows: [blankField()] }])
    setAdding('')
  }

  return (
    <div className="panel role-card editing">
      <div className="section-head">
        <div>
          <h2>Design version {version.version_no}</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            Add the record types this industry needs and the fields each one gets. Save as often as you like; publish when it's ready.
          </p>
        </div>
      </div>

      {sections.length === 0 && (
        <div className="alert info">Start by adding a record type, e.g. “Work unit” for projects.</div>
      )}

      {sections.map((section) => (
        <div key={section.sectionKey} className="pack-section">
          <div className="section-head">
            <h3>Custom fields on {typeName[section.object_type] || section.object_type}</h3>
            <button type="button" className="link-btn danger" onClick={() => removeSection(section.sectionKey)}>Remove record type</button>
          </div>
          <FieldRowsEditor
            fields={section.rows}
            onChange={(rows) => setRows(section.sectionKey, rows)}
            errors={errors}
            idPrefix={`s${section.sectionKey}`}
          />
        </div>
      ))}

      {available.length > 0 && (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Record type to add">
            <option value="">Add fields to a record type…</option>
            {available.map((t) => <option key={t.code} value={t.code}>{t.display_name}</option>)}
          </select>
          <button type="button" className="btn secondary" onClick={addSection} disabled={!adding}>+ Add record type</button>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn" type="button" onClick={() => onSave(content)} disabled={busy || !dirty || hasErrors}>
          {dirty ? 'Save draft' : 'Saved'}
        </button>
        <button className="btn secondary" type="button" onClick={onPublish} disabled={busy || dirty || hasErrors || !sections.length}>
          Publish version {version.version_no}
        </button>
        {dirty && <span className="muted small">Save your changes before publishing.</span>}
      </div>
    </div>
  )
}

function DetailsForm({ pack, verticals, onSave, onCancel }) {
  const [name, setName] = useState(pack.name)
  const [description, setDescription] = useState(pack.description || '')
  const [verticalId, setVerticalId] = useState(pack.vertical.id)

  return (
    <form
      className="panel role-card editing"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name: name.trim(), description: description.trim() || null, vertical_id: verticalId })
      }}
    >
      <h2>Pack details</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="d-name">Name *</label>
          <input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
        </div>
        <div className="field">
          <label htmlFor="d-vertical">Vertical *</label>
          <select id="d-vertical" value={verticalId} onChange={(e) => setVerticalId(e.target.value)}>
            {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="d-desc">Description</label>
        <input id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </div>
      <div className="hint" style={{ marginBottom: 10 }}>The code ({pack.code}) can't be changed.</div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={!name.trim()}>Save details</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
