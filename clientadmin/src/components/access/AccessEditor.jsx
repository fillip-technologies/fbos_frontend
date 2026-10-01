import { useMemo, useState } from 'react'
import UnitSelect from './UnitSelect.jsx'
import {
  actionLabel,
  effectiveAccess,
  entityLabel,
  groupCatalog,
  scopeLabel,
  serviceLabel,
} from './permissions.js'

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

/**
 * Edits a user's access: role presets (copied onto the user) plus individual permissions,
 * each with a scope (whole organization or a unit and everything below it) and an
 * "own records only" switch. `value`/`onChange` hold { presets, permissions }.
 */
export default function AccessEditor({ catalog, roles, units, value, onChange, fieldErrors = {} }) {
  const rolesById = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles])
  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const groups = useMemo(() => groupCatalog(catalog), [catalog])
  const describe = useMemo(() => Object.fromEntries(catalog.map((p) => [p.code, p.description])), [catalog])
  const effective = useMemo(() => effectiveAccess(value, rolesById), [value, rolesById])
  const [openServices, setOpenServices] = useState(() => new Set(groups.map((g) => g.service)))

  const setPresets = (presets) => onChange({ ...value, presets })
  const setPermissions = (permissions) => onChange({ ...value, permissions })

  const addPreset = () =>
    setPresets([...value.presets, { key: key(), role_id: roles[0]?.id || '', scope_unit_id: null, self_only: false }])
  const updatePreset = (k, patch) => setPresets(value.presets.map((p) => (p.key === k ? { ...p, ...patch } : p)))
  const removePreset = (k) => setPresets(value.presets.filter((p) => p.key !== k))

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
            <p className="muted">A preset copies all of a role's permissions onto this user, in the scope you choose.</p>
          </div>
          <button type="button" className="btn secondary" onClick={addPreset} disabled={!roles.length}>
            + Add role
          </button>
        </div>
        {value.presets.length === 0 && <p className="muted small">No role presets. You can still pick individual permissions below.</p>}
        {value.presets.map((preset) => {
          const role = rolesById[preset.role_id]
          return (
            <div key={preset.key} className="preset-row">
              <div className="grid-3">
                <div className="field">
                  <label>Role</label>
                  <select value={preset.role_id} onChange={(e) => updatePreset(preset.key, { role_id: e.target.value })}>
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
                    value={preset.scope_unit_id}
                    emptyLabel="Whole organization"
                    onChange={(id) => updatePreset(preset.key, { scope_unit_id: id })}
                  />
                </div>
                <div className="field checkbox-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={preset.self_only}
                      onChange={(e) => updatePreset(preset.key, { self_only: e.target.checked })}
                    />
                    Only their own records
                  </label>
                  <button type="button" className="link-btn danger" onClick={() => removePreset(preset.key)}>
                    Remove
                  </button>
                </div>
              </div>
              {role && (
                <div className="chips">
                  {role.permissions.length === 0 && <span className="muted small">This role has no permissions.</span>}
                  {role.permissions.map((code) => (
                    <span key={code} className="chip" title={describe[code] || code}>
                      {code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* ---------------- Individual permissions ---------------- */}
      <section className="access-section">
        <div className="section-head">
          <div>
            <h3>Individual permissions</h3>
            <p className="muted">Grant specific actions directly. Each can cover the whole organization or one unit and everything below it.</p>
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
                              emptyLabel="Whole organization"
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
