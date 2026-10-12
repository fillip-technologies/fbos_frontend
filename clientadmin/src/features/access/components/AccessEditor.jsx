import { useMemo, useState } from 'react'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import {
  actionLabel,
  applyPreset,
  effectiveAccess,
  entityLabel,
  groupCatalog,
  pruneUnheldPresets,
  removePresets,
  samePresetScope,
  scopeLabel,
  serviceLabel,
  syncPresets,
  updatePreset,
} from '@/features/access/permissions.js'

let nextKey = 1
const key = () => `k${nextKey++}`

export const EMPTY_ACCESS = { presets: [], permissions: [] }

// Converts GET /users/{id}/permissions rows (and the user's role presets) into editor
// state. Everything is loaded as an individual permission (labelled with the preset it
// came from), so saving never re-adds a permission that was removed from a preset after
// it was applied. Presets are loaded too, so each can be removed again.
export function accessFromGrants(grants, assignments = []) {
  const presets = assignments.map((a) => ({
    key: key(),
    role_id: a.role.id,
    role_code: a.role.code,
    scope_unit_id: a.scope_unit?.id || null,
    self_only: a.self_only,
  }))
  return {
    presets,
    permissions: grants.map((g) => {
      const unit = g.scope_unit?.id || null
      const preset = presets.find((p) => p.role_code === g.source_role && p.scope_unit_id === unit)
      return {
        key: key(),
        code: g.code,
        scope_unit_id: unit,
        self_only: g.self_only,
        source_role: g.source_role,
        ...(preset ? { preset_key: preset.key } : {}),
      }
    }),
  }
}

// Editor state for an existing user, with each preset brought up to its role's current
// permissions. `changes` lists what that adds, so it can be shown before saving.
export function loadAccess(grants, assignments, roles) {
  const rolesById = Object.fromEntries(roles.map((r) => [r.id, r]))
  return syncPresets(accessFromGrants(grants, assignments), rolesById, key)
}

const NO_ROLE_DRAFT = { role_id: '', scope_unit_id: null, self_only: false }

/**
 * Edits a user's access as individual permissions, each with a scope (whole organization or
 * a unit and everything below it) and an "own records only" switch. Applying a role adds
 * its permissions (tagged "from <role>") at a starting level that can then be changed per
 * permission. `value`/`onChange` hold { presets: roles applied here, permissions }.
 */
export default function AccessEditor({ catalog, roles, units, value, onChange, fieldErrors = {}, presetsEditable = true }) {
  const rolesById = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles])
  const unitsById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units])
  const groups = useMemo(() => groupCatalog(catalog), [catalog])
  const describe = useMemo(() => Object.fromEntries(catalog.map((p) => [p.code, p.description])), [catalog])
  const effective = useMemo(() => effectiveAccess(value), [value])
  const [openServices, setOpenServices] = useState(() => new Set(groups.map((g) => g.service)))
  const [roleDraft, setRoleDraft] = useState(NO_ROLE_DRAFT)
  const [presetNotice, setPresetNotice] = useState('')

  const roleName = (preset) => rolesById[preset.role_id]?.name || 'Role'
  const isDuplicate = (preset, exceptKey) =>
    value.presets.some((p) => p.key !== exceptKey && samePresetScope(p, preset))

  // Editing a single permission can mean a preset no longer fully applies: it's taken off
  // (its permissions stay) and the editor says so.
  const setPermissions = (permissions) => {
    const { value: next, dropped } = pruneUnheldPresets({ ...value, permissions }, rolesById)
    setPresetNotice(
      dropped.length
        ? `${dropped.map(roleName).join(', ')} no longer applies in full, so the role preset was taken off. Its other permissions stay.`
        : ''
    )
    onChange(next)
  }

  const draftDuplicate = Boolean(roleDraft.role_id) && isDuplicate(roleDraft)
  const applyRole = () => {
    if (!rolesById[roleDraft.role_id] || draftDuplicate) return
    setPresetNotice('')
    onChange(applyPreset(value, { key: key(), ...roleDraft }, rolesById, key))
    setRoleDraft(NO_ROLE_DRAFT)
  }
  const removePreset = (k) => {
    setPresetNotice('')
    onChange(removePresets(value, [k], rolesById))
  }
  const removeAllPresets = () => {
    setPresetNotice('')
    onChange(removePresets(value, value.presets.map((p) => p.key), rolesById))
  }
  const changePreset = (preset, patch) => {
    if (isDuplicate({ ...preset, ...patch }, preset.key)) {
      setPresetNotice(`${roleName(preset)} is already applied there.`)
      return
    }
    setPresetNotice('')
    onChange(updatePreset(value, preset.key, patch, rolesById, key))
  }
  // How many permissions removing a preset takes away (nothing else grants them there).
  const lostOnRemove = (preset) => value.permissions.length - removePresets(value, [preset.key], rolesById).permissions.length

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
              A user can have several roles, each at its own level. A role's permissions are added below; removing a
              role takes away only what no other role or direct permission still gives.
            </p>
          </div>
          {presetsEditable && value.presets.length > 1 && (
            <button type="button" className="btn danger-outline" onClick={removeAllPresets}>
              Remove all roles
            </button>
          )}
        </div>

        {!presetsEditable ? (
          <p className="muted small">
            You can't see this user's role presets, so roles can't be changed here. Saving keeps the ones they have.
          </p>
        ) : (
          <>
            {presetNotice && <div className="alert info">{presetNotice}</div>}
            {value.presets.length === 0 ? (
              <p className="muted small">No roles applied.</p>
            ) : (
              <table className="compact preset-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Applies to</th>
                    <th>Own records only</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {value.presets.map((preset) => {
                    const lost = lostOnRemove(preset)
                    return (
                      <tr key={preset.key}>
                        <td>
                          <b>{roleName(preset)}</b>
                          <div className="muted small">{rolesById[preset.role_id]?.permissions.length ?? 0} permissions</div>
                        </td>
                        <td>
                          <UnitSelect
                            units={units}
                            value={preset.scope_unit_id}
                            emptyLabel="Whole company"
                            onChange={(id) => changePreset(preset, { scope_unit_id: id })}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={preset.self_only}
                            aria-label={`${roleName(preset)}: only their own records`}
                            onChange={(e) => changePreset(preset, { self_only: e.target.checked })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="link-btn danger"
                            onClick={() => removePreset(preset.key)}
                            title={lost ? `Takes away ${lost} permission${lost === 1 ? '' : 's'}` : 'Every permission stays: other roles give them'}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <div className="preset-row">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="apply-role">Add a role</label>
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
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={applyRole}
                    disabled={!rolesById[roleDraft.role_id] || draftDuplicate}
                  >
                    Add role
                  </button>
                  {draftDuplicate && <div className="hint">Already applied there.</div>}
                </div>
              </div>
            </div>
          </>
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
