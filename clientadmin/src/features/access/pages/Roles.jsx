import { useMemo, useState } from 'react'
import '@/features/access/access.css'
import { accessApi } from '@/features/access/api.js'
import AccessChips, { AccessLevel } from '@/features/access/components/AccessChips.jsx'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { actionLabel, entityLabel, groupCatalog, serviceLabel } from '@/features/access/permissions.js'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
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
            A role is a job’s set of permissions in {activeOrg ? `“${activeOrg.name}”` : 'this company'}, for example “Team lead”.
            Give a person a role instead of ticking permissions one by one.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setEditing(null)} />
          {canCreate && <button className="btn" onClick={() => setEditing('new')} disabled={editing === 'new'}>+ New role</button>}
        </div>
      </div>

      <p className="role-help">
        <strong>How it works:</strong> make a role once, then open a person under <strong>Users → Access</strong> and add the role.
        Changing a role later affects only people who are given it from then on.
      </p>
      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} onRetry={reload} />

      {editing === 'new' && (
        <RoleForm orgId={orgId} catalog={catalog} onCancel={() => setEditing(null)} onSaved={(r) => saved(`Role “${r.name}” created.`)} />
      )}

      {loading ? (
        <PanelSkeleton panels={3} lines={3} />
      ) : (
        roles.map((role) =>
          editing?.id === role.id ? (
            <RoleForm key={role.id} orgId={orgId} catalog={catalog} role={role} onCancel={() => setEditing(null)} onSaved={(r) => saved(`Role “${r.name}” updated.`)} />
          ) : (
            <div key={role.id} className="panel role-card">
              <div className="section-head">
                <div>
                  <h2>{role.name} <AccessLevel count={role.permissions.length} total={catalog.length} /></h2>
                  <p className="muted small" style={{ margin: '2px 0 0' }}>
                    {role.is_system ? 'Built in · can do everything' : 'Made by you'} · {role.permissions.length} permissions
                  </p>
                </div>
                {!role.is_system && canUpdate && (
                  <button className="btn secondary" onClick={() => setEditing(role)}>Edit permissions</button>
                )}
              </div>
              <AccessChips codes={role.permissions} catalog={catalog} empty="No permissions yet." />
              {role.permissions.length > 0 && (
                <details className="ae-list">
                  <summary>See every permission</summary>
                  <div className="chips">
                    {role.permissions.map((code) => (
                      <span key={code} className="chip" title={code}>{actionLabel(code)} · {code.split('.').slice(0, -1).join(' ')}</span>
                    ))}
                  </div>
                </details>
              )}
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
  const [search, setSearch] = useState('')
  const slug = (text) => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const finalCode = code.trim() || slug(name)
  const [selected, setSelected] = useState(() => new Set(role?.permissions || []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const allGroups = useMemo(() => groupCatalog(catalog), [catalog])
  const [openAreas, setOpenAreas] = useState(() => new Set(allGroups.filter((g) => g.entities.some((e) => e.permissions.some((p) => role?.permissions.includes(p.code)))).map((g) => g.service)))
  const term = search.trim().toLowerCase()
  const groups = useMemo(() => {
    if (!term) return allGroups
    const hit = (p, entity, service) => [p.code, p.description, actionLabel(p.code), entityLabel(entity, service), serviceLabel(service)].some((t) => (t || '').toLowerCase().includes(term))
    return allGroups
      .map((g) => ({ ...g, entities: g.entities.map((e) => ({ ...e, permissions: e.permissions.filter((p) => hit(p, e.entity, g.service)) })).filter((e) => e.permissions.length) }))
      .filter((g) => g.entities.length)
  }, [allGroups, term])
  const toggleArea = (service) =>
    setOpenAreas((s) => {
      const next = new Set(s)
      if (next.has(service)) next.delete(service)
      else next.add(service)
      return next
    })

  const toggle = (permCode) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(permCode)) next.delete(permCode)
      else next.add(permCode)
      return next
    })
  const setMany = (permissions, on) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const p of permissions) on ? next.add(p.code) : next.delete(p.code)
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
        ? await accessApi.createRole(orgId, { code: finalCode, name: name.trim(), permissions })
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
        <>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="r-name">What is this role called? *</label>
            <input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} placeholder="e.g. Digital marketing head" />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
          </div>
        </div>
        <details className="ae-code" open={!slug(name) && name.length > 0 || Boolean(fieldErrors.code)}>
          <summary>Short code (made from the name; you can skip this)</summary>
          <div className="field" style={{ maxWidth: 360 }}>
            <input id="r-code" value={code} onChange={(e) => setCode(e.target.value)} required={!slug(name)} pattern="[A-Za-z0-9_\-]+" placeholder={slug(name) || 'team_lead'} aria-label="Short code" />
            <div className="hint">Letters, digits, “_” and “-”. Unique in this company.</div>
            {fieldErrors.code && <div className="field-error">{fieldErrors.code}</div>}
          </div>
        </details>
        </>
      )}
      {!isNew && (
        <p className="muted small">Changes apply to users this role is given to from now on. Users who already have it keep their current permissions.</p>
      )}

      <p className="muted small" style={{ margin: '12px 0 6px' }}>Tick what this role may do. Open an area to see its actions, or search.</p>
      <div className="field role-search">
        <input type="search" aria-label="Search permissions" placeholder="Search, e.g. invoice, task, leave" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {groups.length === 0 && <p className="muted small">Nothing matches “{search}”.</p>}
      {groups.map((group) => {
        const chosen = group.entities.reduce((n, e) => n + e.permissions.filter((p) => selected.has(p.code)).length, 0)
        const isOpen = Boolean(term) || openAreas.has(group.service)
        return (
        <div key={group.service} className="perm-group">
          <div className="perm-group-bar">
            <button type="button" className="perm-group-head" aria-expanded={isOpen} onClick={() => toggleArea(group.service)}>
              {isOpen ? '▾' : '▸'} {serviceLabel(group.service)} <span className="perm-count">· {chosen} ticked</span>
            </button>
            {chosen > 0 && (
              <button type="button" className="perm-clear" title={`Untick everything under ${serviceLabel(group.service)}`} onClick={() => setMany(group.entities.flatMap((e) => e.permissions), false)}>
                ✕ Remove all
              </button>
            )}
          </div>
          {isOpen && group.entities.map(({ entity, permissions }) => {
            const allOn = permissions.every((p) => selected.has(p.code))
            return (
              <div key={entity} className="perm-entity">
                <div className="perm-entity-name">
                  {entityLabel(entity, group.service)}
                  {permissions.some((p) => selected.has(p.code)) && (
                    <button type="button" className="link-btn danger" title="Untick this whole group" onClick={() => toggleEntity(permissions, false)}>
                      − Clear
                    </button>
                  )}
                  {!allOn && (
                    <button type="button" className="link-btn" title="Tick this whole group" onClick={() => toggleEntity(permissions, true)}>
                      + All
                    </button>
                  )}
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
        )
      })}

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isNew ? `Create role (${selected.size})` : `Save (${selected.size} permissions)`}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
