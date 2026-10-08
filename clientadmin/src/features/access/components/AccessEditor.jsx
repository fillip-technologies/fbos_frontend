import { useMemo, useState } from 'react'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import {
  actionLabel,
  effectiveAccess,
  entityLabel,
  groupCatalog,
  scopeLabel,
  serviceLabel,
} from '@/features/access/permissions.js'

let nextKey = 1
const key = () => `k${nextKey++}`

export const EMPTY_ACCESS = { presets: [], permissions: [] }

// Converts GET /users/{id}/permissions rows into editor state. Everything is loaded as an
// individual permission (labelled with the preset it came from), so saving never
// re-adds a permission that was removed from a preset after it was applied.
export function accessFromGrants(grants) {
  return {
    presets: [],
    permissions: grants.map((g) => ({
      key: key(),
      code: g.code,
      scope_unit_id: g.scope_unit?.id || null,
      self_only: g.self_only,
      source_role: g.source_role,
    })),
  }
}

const NO_ROLE_DRAFT = { role_id: '', scope_unit_id: null, self_only: false }

/**
 * Edits a user's access as individual permissions, each with a scope (whole organization or
 * a unit and everything below it) and an "own records only" switch. Applying a role adds
 * its permissions (tagged "from <role>") at a starting level that can then be changed per
 * permission. `value`/`onChange` hold { presets: roles applied here, permissions }.
 */
export default function AccessEditor({ catalog, roles, units, value, onChange, fieldErrors = {} }) {
  const rolesById = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles])
  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const groups = useMemo(() => groupCatalog(catalog), [catalog])
  const describe = useMemo(() => Object.fromEntries(catalog.map((p) => [p.code, p.description])), [catalog])
  const effective = useMemo(() => effectiveAccess(value), [value])
  const [openServices, setOpenServices] = useState(() => new Set(groups.map((g) => g.service)))
  const [roleDraft, setRoleDraft] = useState(NO_ROLE_DRAFT)

  const setPermissions = (permissions) => onChange({ ...value, permissions })

  const applyRole = () => {
    const role = rolesById[roleDraft.role_id]
    if (!role) return
    const preset = { key: key(), ...roleDraft }
    const level = { scope_unit_id: roleDraft.scope_unit_id || null, self_only: roleDraft.self_only }
    const heldThere = (code) =>
      value.permissions.some((p) => p.code === code && (p.scope_unit_id || null) === level.scope_unit_id)
    const added = role.permissions
      .filter((code) => !heldThere(code))
      .map((code) => ({ key: key(), code, ...level, source_role: role.code, preset_key: preset.key }))
    onChange({ presets: [...value.presets, preset], permissions: [...value.permissions, ...added] })
    setRoleDraft(NO_ROLE_DRAFT)
  }
  const removePreset = (k) =>
    onChange({
      presets: value.presets.filter((p) => p.key !== k),
      permissions: value.permissions.filter((p) => p.preset_key !== k),
    })

  const entriesFor = (code) => value.permissions.filter((p) => p.code === code)
  const togglePermission = (code, on) =>
    setPermissions(
      on
        ? [...value.permissions, { key: key(), code, scope_unit_id: null, self_only: false }]
        : value.permissions.filter((p) => p.code !== code)
    )
  const addScope = (code) =>
    setPermissions([...value.permissions, { key: key(), code, scope_unit_id: units[0]?.id || null, self_only: false }])
  const updateEntry = (k, patch) => setPermissions(value.permissions.map((p) => (p.key === k ? { ...p, ...patch } : p)))
  const removeEntry = (k) => setPermissions(value.permissions.filter((p) => p.key !== k))

  const toggleService = (service) =>
    setOpenServices((s) => {
      const next = new Set(s)
      if (next.has(service)) next.delete(service)
      else next.add(service)
      return next
    })

  const serverErrors = Object.entries(fieldErrors).filter(([f]) => f.startsWith('permissions[') || f.startsWith('role_assignments['))

  return (
    <div className="access-editor">
      {serverErrors.length > 0 && (
        <div className="alert error">
          {serverErrors.map(([f, issue]) => (
            <div key={f}>
              <span className="mono">{f}</span>: {issue}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Role presets ---------------- */}
      <section className="access-section">
        <div className="section-head">
          <div>
            <h3>Role presets</h3>
            <p className="muted">
              Applying a role adds each of its permissions below at the level you pick here. You can then change any
              permission's level on its own.
            </p>
          </div>
        </div>
        <div className="preset-row">
          <div className="grid-3">
            <div className="field">
              <label htmlFor="apply-role">Role</label>
              <select id="apply-role" value={roleDraft.role_id} onChange={(e) => setRoleDraft((d) => ({ ...d, role_id: e.target.value }))}>
                <option value="">{roles.length ? '— Choose a role —' : 'No roles yet'}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.permissions.length} permissions)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Applies to</label>
              <UnitSelect
                units={units}
                value={roleDraft.scope_unit_id}
                emptyLabel="Whole company"
                onChange={(id) => setRoleDraft((d) => ({ ...d, scope_unit_id: id }))}
              />
            </div>
            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={roleDraft.self_only}
                  onChange={(e) => setRoleDraft((d) => ({ ...d, self_only: e.target.checked }))}
                />
                Only their own records
              </label>
              <button type="button" className="btn secondary" onClick={applyRole} disabled={!rolesById[roleDraft.role_id]}>
                Apply role
              </button>
            </div>
          </div>
        </div>
        {value.presets.length > 0 && (
          <div className="chips">
            {value.presets.map((preset) => (
              <span key={preset.key} className="chip">
                {rolesById[preset.role_id]?.name || 'Role'} · {scopeLabel(preset.scope_unit_id, unitsById, preset.self_only)}{' '}
                <button
                  type="button"
                  className="link-btn danger"
                  onClick={() => removePreset(preset.key)}
                  aria-label={`Remove the ${rolesById[preset.role_id]?.name || ''} role and the permissions it added`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Individual permissions ---------------- */}
      <section className="access-section">
        <div className="section-head">
          <div>
            <h3>Individual permissions</h3>
            <p className="muted">Grant specific actions directly. Each can cover the whole company or one branch, department or team and everything under it.</p>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.service} className="perm-group">
            <button type="button" className="perm-group-head" onClick={() => toggleService(group.service)}>
              <span>{openServices.has(group.service) ? '▾' : '▸'}</span> {serviceLabel(group.service)}
              <span className="muted small">
                {' '}· {group.entities.reduce((n, e) => n + e.permissions.filter((p) => entriesFor(p.code).length).length, 0)} selected
              </span>
            </button>
            {openServices.has(group.service) &&
              group.entities.map(({ entity, permissions }) => (
                <div key={entity} className="perm-entity">
                  <div className="perm-entity-name">{entityLabel(entity)}</div>
                  {permissions.map((perm) => {
                    const entries = entriesFor(perm.code)
                    return (
                      <div key={perm.code} className={`perm-row${entries.length ? ' on' : ''}`}>
                        <label className="perm-check">
                          <input
                            type="checkbox"
                            checked={entries.length > 0}
                            onChange={(e) => togglePermission(perm.code, e.target.checked)}
                          />
                          <span>
                            <b>{actionLabel(perm.code)}</b>
                            <span className="muted small"> — {perm.description || perm.code}</span>
                            <div className="mono muted">{perm.code}</div>
                          </span>
                        </label>
                        {entries.map((entry) => (
                          <div key={entry.key} className="perm-scope">
                            <UnitSelect
                              units={units}
                              value={entry.scope_unit_id}
                              emptyLabel="Whole company"
                              onChange={(id) => updateEntry(entry.key, { scope_unit_id: id })}
                            />
                            <label className="inline-check">
                              <input
                                type="checkbox"
                                checked={entry.self_only}
                                onChange={(e) => updateEntry(entry.key, { self_only: e.target.checked })}
                              />
                              Own records only
                            </label>
                            {entry.source_role && <span className="chip subtle">from {entry.source_role}</span>}
                            {entries.length > 1 && (
                              <button type="button" className="link-btn danger" onClick={() => removeEntry(entry.key)}>
                                Remove scope
                              </button>
                            )}
                          </div>
                        ))}
                        {entries.length > 0 && units.length > 0 && (
                          <button type="button" className="link-btn" onClick={() => addScope(perm.code)}>
                            + Another scope
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
          </div>
        ))}
      </section>

      {/* ---------------- Summary ---------------- */}
      <section className="access-section">
        <h3>Effective access ({effective.length})</h3>
        {effective.length === 0 ? (
          <p className="muted small">No permissions: the user can sign in but can't open anything.</p>
        ) : (
          <table className="compact">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Scope</th>
                <th>From</th>
              </tr>
            </thead>
            <tbody>
              {effective.map((e) => (
                <tr key={`${e.code}|${e.scope_unit_id}`}>
                  <td>
                    <div>{describe[e.code] || actionLabel(e.code)}</div>
                    <div className="mono muted">{e.code}</div>
                  </td>
                  <td>{scopeLabel(e.scope_unit_id, unitsById, e.self_only)}</td>
                  <td>{e.sources.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
