import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { verticalPacksApi, verticalsApi } from '@/features/verticals/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import InstallPanel from '@/features/verticals/components/InstallPanel.jsx'
import VerticalsPanel from '@/features/verticals/components/VerticalsPanel.jsx'

const codeFromName = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)

// Vertical packs: the client's own setups for an industry. A pack is designed once for the
// whole client in versions (draft -> published), and each company installs the version it
// wants. Today a pack holds custom fields for any record types.
export default function VerticalPacks() {
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canDesign = hasAccess(user, ACCESS.designPacks)
  const canInstall = hasAccess(user, ACCESS.installPacks)
  const canManageVerticals = hasAccess(user, ACCESS.manageVerticals)

  const [packs, setPacks] = useState([])
  const [verticals, setVerticals] = useState([])
  const [objectTypes, setObjectTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [installing, setInstalling] = useState(null) // pack id
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    Promise.all([verticalPacksApi.list(orgId), verticalsApi.list(orgId), verticalsApi.objectTypes(orgId)])
      .then(([p, v, t]) => {
        setPacks(p)
        setVerticals(v)
        setObjectTypes(t)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId])
  useEffect(load, [load])

  const typeName = useMemo(() => Object.fromEntries(objectTypes.map((t) => [t.code, t.display_name])), [objectTypes])
  const companyName = activeOrg ? `“${activeOrg.name}”` : 'this company'

  const installed = (installation) => {
    const pack = packs.find((p) => p.id === installing)
    setInstalling(null)
    setNotice(`${pack?.name || 'Pack'} version ${installation.version_no} is installed in ${companyName}.`)
    load()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Vertical packs</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Build your own setup for an industry: the custom fields its projects, deals and invoices need. Design a pack
            once, publish a version, then install it in each company. Companies keep their version until you choose to update.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setInstalling(null)} />
          {canDesign && <button className="btn" onClick={() => setCreating(true)} disabled={creating}>+ New pack</button>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={load} />

      {!loading && (
        <VerticalsPanel orgId={orgId} verticals={verticals} canManage={canManageVerticals} onChanged={load} />
      )}

      {creating && <PackForm orgId={orgId} verticals={verticals.filter((v) => v.status === 'active')} onCancel={() => setCreating(false)} />}

      {loading ? (
        <div className="center-note">Loading…</div>
      ) : packs.length === 0 ? (
        !creating && (
          <div className="panel empty-state">
            <h2>No packs yet</h2>
            <p className="muted">
              A pack bundles the custom fields an industry needs, e.g. “Site address” and “Permit number” on projects for construction.
            </p>
            {canDesign && <button className="btn" onClick={() => setCreating(true)}>+ New pack</button>}
          </div>
        )
      ) : (
        packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            canInstall={canInstall}
            installing={installing === pack.id}
            onInstall={() => { setNotice(''); setInstalling(pack.id) }}
          >
            {installing === pack.id && (
              <InstallPanel
                orgId={orgId}
                pack={pack}
                companyName={companyName}
                typeName={typeName}
                onInstalled={installed}
                onCancel={() => setInstalling(null)}
              />
            )}
          </PackCard>
        ))
      )}
    </div>
  )
}

function PackCard({ pack, canInstall, installing, onInstall, children }) {
  const latest = pack.latest_published_version
  const installedVersion = pack.installation?.version_no
  const updateAvailable = installedVersion && latest && latest > installedVersion
  const latestContent = pack.versions.find((v) => v.version_no === (latest || pack.draft_version))?.content
  const sectionCount = latestContent?.sections.length || 0
  const fieldCount = latestContent?.sections.reduce((n, s) => n + s.fields.length, 0) || 0

  return (
    <div className={`panel role-card${installing ? ' editing' : ''}`}>
      <div className="section-head">
        <div>
          <h2>
            <Link to={`/vertical-packs/${pack.id}`}>{pack.name}</Link> <span className="chip">{pack.code}</span>
          </h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {pack.vertical.name} · {latest ? `version ${latest} published` : 'not published yet'}
            {pack.draft_version ? ` · draft v${pack.draft_version} in progress` : ''} · {fieldCount} field{fieldCount === 1 ? '' : 's'} on {sectionCount} record type{sectionCount === 1 ? '' : 's'}
          </p>
          {pack.description && <p className="small" style={{ margin: '6px 0 0' }}>{pack.description}</p>}
        </div>
        <div className="row-actions">
          <Link className="btn secondary" to={`/vertical-packs/${pack.id}`}>Open</Link>
          {canInstall && latest && !installing && (
            <button className="btn" onClick={onInstall}>{installedVersion ? (updateAvailable ? 'Update' : 'Change version') : 'Install'}</button>
          )}
        </div>
      </div>
      <div className="small">
        {installedVersion ? (
          <>
            <span className="badge active">Installed v{installedVersion}</span>
            {updateAvailable && <span className="badge upcoming" style={{ marginLeft: 6 }}>Version {latest} available</span>}
          </>
        ) : (
          <span className="muted">Not installed in this company.</span>
        )}
      </div>
      {children}
    </div>
  )
}

function PackForm({ orgId, verticals, onCancel }) {
  const navigate = useNavigate()
  const [verticalId, setVerticalId] = useState(verticals[0]?.id || '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeEdited, setCodeEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const pack = await verticalPacksApi.create(orgId, {
        vertical_id: verticalId,
        code,
        name: name.trim(),
        description: description.trim() || null,
      })
      navigate(`/vertical-packs/${pack.id}`)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  if (!verticals.length) {
    return (
      <div className="panel role-card editing">
        <h2>New pack</h2>
        <p className="muted">Add a vertical above first. Every pack belongs to one.</p>
        <button className="btn secondary" onClick={onCancel}>Close</button>
      </div>
    )
  }

  return (
    <form className="panel role-card editing" onSubmit={submit}>
      <h2>New pack</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="p-name">Name *</label>
          <input id="p-name" value={name} required maxLength={255} placeholder="House construction"
            onChange={(e) => { setName(e.target.value); if (!codeEdited) setCode(codeFromName(e.target.value)) }} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="p-code">Code *</label>
          <input id="p-code" value={code} required maxLength={100} pattern="[a-z0-9][a-z0-9\-]*" placeholder="house-construction"
            onChange={(e) => { setCode(e.target.value); setCodeEdited(true) }} />
          {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
        </div>
        <div className="field">
          <label htmlFor="p-vertical">Vertical *</label>
          <select id="p-vertical" value={verticalId} onChange={(e) => setVerticalId(e.target.value)} required>
            {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-desc">Description</label>
        <input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Fields every house project needs" />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !name.trim() || !code || !verticalId}>
          {saving ? 'Creating…' : 'Create and design'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
