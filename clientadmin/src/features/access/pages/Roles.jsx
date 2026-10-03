import { useMemo, useState } from 'react'
import { accessApi } from '@/features/access/api.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { actionLabel, entityLabel, groupCatalog, serviceLabel } from '@/features/access/permissions.js'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'

// Roles are presets: applying one copies its permissions onto a user. Changing a role
// later affects only users it is applied to from then on.
export default function Roles() {
  const { user: me } = useAuth()
  const canCreate = hasAccess(me, ACCESS.createRoles)
  const canUpdate = hasAccess(me, ACCESS.updateRoles)
  const { orgId, activeOrg } = useActiveOrg()
  const { catalog, roles, loading, error, reload } = useAccessCatalog(orgId)
  const [editing, setEditing] = useState(null) // role being edited, or 'new'
  const [notice, setNotice] = useState('')

  const saved = (message) => {
    setEditing(null)
    setNotice(message)
    reload()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Roles</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Ready-made sets of permissions for {activeOrg ? `“${activeOrg.name}”` : 'this organization'}. Applying a role
            copies its permissions onto the user; you can then adjust them per user.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setEditing(null)} />
          {canCreate && <button className="btn" onClick={() => setEditing('new')} disabled={editing === 'new'}>+ New role</button>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={reload} />

      {editing === 'new' && (
        <RoleForm orgId={orgId} catalog={catalog} onCancel={() => setEditing(null)} onSaved={(r) => saved(`Role “${r.name}” created.`)} />
      )}

      {loading ? (
        <div className="center-note">Loading…</div>
      ) : (
        roles.map((role) =>
          editing?.id === role.id ? (
            <RoleForm key={role.id} orgId={orgId} catalog={catalog} role={role} onCancel={() => setEditing(null)} onSaved={(r) => saved(`Role “${r.name}” updated.`)} />
          ) : (
            <div key={role.id} className="panel role-card">
              <div className="section-head">
                <div>
                  <h2>
                    {role.name} <span className="mono muted">{role.code}</span>
                  </h2>
                  <p className="muted small" style={{ margin: '2px 0 0' }}>
                    {role.is_system ? 'Built-in · always holds every permission' : 'Custom role'} · {role.permissions.length} permissions
                  </p>
                </div>
                {!role.is_system && canUpdate && (
                  <button className="btn secondary" onClick={() => setEditing(role)}>Edit permissions</button>
                )}
              </div>
              <div className="chips">
                {role.permissions.length === 0 && <span className="muted small">No permissions.</span>}
                {role.permissions.map((code) => (
                  <span key={code} className="chip">{code}</span>
                ))}
              </div>
            </div>
          )
        )
      )}
    </div>
  )
}

function RoleForm({ orgId, catalog, role, onCancel, onSaved }) {
  const isNew = !role
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(() => new Set(role?.permissions || []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const groups = useMemo(() => groupCatalog(catalog), [catalog])

  const toggle = (permCode) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(permCode)) next.delete(permCode)
      else next.add(permCode)
      return next
    })
  const toggleEntity = (permissions, on) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const p of permissions) on ? next.add(p.code) : next.delete(p.code)
      return next
    })

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const permissions = catalog.map((p) => p.code).filter((c) => selected.has(c))
    try {
      const result = isNew
        ? await accessApi.createRole(orgId, { code: code.trim(), name: name.trim(), permissions })
        : await accessApi.replaceRolePermissions(orgId, role.id, role.version, permissions)
      onSaved(result)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel role-card editing" onSubmit={submit}>
      <h2>{isNew ? 'New role' : `Edit “${role.name}”`}</h2>
      {error && Object.keys(fieldErrors).length === 0 && <div className="alert error">{friendlyMessage(error)}</div>}
      {isNew && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="r-name">Name *</label>
            <input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} placeholder="Team Lead" />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="r-code">Code *</label>
            <input id="r-code" value={code} onChange={(e) => setCode(e.target.value)} required pattern="[A-Za-z0-9_\-]+" placeholder="team_lead" />
            <div className="hint">Letters, digits, “_” and “-”. Unique in this organization.</div>
            {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
          </div>
        </div>
      )}
      {!isNew && (
        <p className="muted small">Changes apply to users this role is given to from now on. Users who already have it keep their current permissions.</p>
      )}

      {groups.map((group) => (
        <div key={group.service} className="perm-group">
          <div className="perm-group-head static">{serviceLabel(group.service)}</div>
          {group.entities.map(({ entity, permissions }) => {
            const allOn = permissions.every((p) => selected.has(p.code))
            return (
              <div key={entity} className="perm-entity">
                <div className="perm-entity-name">
                  {entityLabel(entity)}
                  <button type="button" className="link-btn" onClick={() => toggleEntity(permissions, !allOn)}>
                    {allOn ? 'Clear' : 'Select all'}
                  </button>
                </div>
                <div className="perm-checks">
                  {permissions.map((p) => (
                    <label key={p.code} className="inline-check" title={p.code}>
                      <input type="checkbox" checked={selected.has(p.code)} onChange={() => toggle(p.code)} />
                      {actionLabel(p.code)} <span className="muted small">— {p.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isNew ? `Create role (${selected.size})` : `Save (${selected.size} permissions)`}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
