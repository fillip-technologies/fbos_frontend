import { useState } from 'react'
import {
  createAccessRoleMapping,
  createDelegation,
  deleteAccessRoleMapping,
  endDelegation,
  getAccessRoleMappings,
  getJobProfiles,
  getMyDelegations,
  getStandingApprovers,
  setStandingApprovers,
} from '../api.js'
import { formatDate, toList, todayISO } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import Field from '../components/Field.jsx'
import useUserNames from '../useUserNames.js'

const APPROVER_ROLES = [
  ['hr_head', 'HR head', 'Joins the approvals of every demotion.'],
  ['finance', 'Finance', 'Joins the approvals of every change that moves someone’s salary.'],
]

// Who approves what, and what access a job brings. Approvers must also hold the permission to approve role changes.
export default function RoleChangeSetup() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canSetUp = hasAccess(user, ACCESS.manageRoleChangeSetup)
  const canDelegate = hasAccess(user, ACCESS.approveRoleChanges)
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Approvals and access</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Every role change needs one approval. Some need more: department heads for a new post, the HR head for a demotion, finance for a salary change.
          </p>
        </div>
      </div>
      {canSetUp && <StandingApprovers orgId={orgId} />}
      {canSetUp && <AccessMappings orgId={orgId} canMap={hasAccess(user, ACCESS.mapAccessRoles)} />}
      {canDelegate && <Delegations orgId={orgId} />}
    </div>
  )
}

function StandingApprovers({ orgId }) {
  const { users, nameOf, canListUsers } = useUserNames(orgId)
  const query = useQuery(['role-change-approvers', orgId], ({ signal }) => getStandingApprovers({ signal }), { enabled: Boolean(orgId) })
  const [error, setError] = useState(null)
  const [pick, setPick] = useState({})
  const held = Object.fromEntries((query.data?.data ?? []).map((row) => [row.role_key, row.user_ids]))

  const save = async (roleKey, userIds) => {
    try {
      setError(null)
      await setStandingApprovers(roleKey, userIds)
      invalidate(['role-change-approvers', orgId])
      setPick((p) => ({ ...p, [roleKey]: '' }))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="panel">
      <h2 className="form-section" style={{ fontSize: 16 }}>Standing approvers</h2>
      <ErrorBanner error={query.error || error} onRetry={query.reload} />
      {query.loading ? <PanelSkeleton lines={2} /> : APPROVER_ROLES.map(([key, label, hint]) => (
        <div key={key} className="field">
          <label>{label}</label>
          <div className="muted small">{hint} With nobody set, the step is left out.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
            {(held[key] ?? []).length === 0 && <span className="muted small">Nobody set</span>}
            {(held[key] ?? []).map((id) => (
              <span key={id} className="badge" style={{ background: '#eff6ff', color: '#1e40af' }}>
                {nameOf(id, id.slice(0, 8))}{' '}
                <button type="button" className="link-btn" aria-label={`Remove ${nameOf(id, 'approver')}`} onClick={() => save(key, held[key].filter((u) => u !== id))}>×</button>
              </span>
            ))}
          </div>
          {canListUsers ? (
            <div className="row-actions">
              <select value={pick[key] || ''} onChange={(e) => setPick((p) => ({ ...p, [key]: e.target.value }))}>
                <option value="">Add a person…</option>
                {users.filter((u) => !(held[key] ?? []).includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <button type="button" className="btn secondary" disabled={!pick[key]} onClick={() => save(key, [...(held[key] ?? []), pick[key]])}>Add</button>
            </div>
          ) : (
            <div className="muted small">Naming people needs permission to read users.</div>
          )}
        </div>
      ))}
    </div>
  )
}

function AccessMappings({ orgId, canMap }) {
  const { roles } = useAccessCatalog(orgId)
  const query = useQuery(['access-role-mappings', orgId], ({ signal }) => getAccessRoleMappings({ signal }), { enabled: Boolean(orgId) })
  const profiles = useLookup(['job-profiles', orgId], ({ signal }) => getJobProfiles({ signal }).catch(() => ({ data: [] })), { enabled: Boolean(orgId) })
  const empty = { match_type: 'designation', match_value: '', role_code: '', scope: 'department' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = getFieldErrors(error)
  const profileList = toList(profiles.data)
  const profileName = (id) => profileList.find((p) => p.id === id)?.title || id

  const add = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createAccessRoleMapping(form)
      invalidate(['access-role-mappings', orgId])
      setForm(empty)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id) => {
    try {
      setError(null)
      await deleteAccessRoleMapping(id)
      invalidate(['access-role-mappings', orgId])
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="panel">
      <h2 className="form-section" style={{ fontSize: 16 }}>Access that comes with a job</h2>
      <p className="muted small">
        Everyone who holds a matching post gets the role, for the post’s department or company-wide, and loses it when the post ends.
        Roles granted by hand under Users are never touched. A job profile is used before a designation.
      </p>
      <ErrorBanner error={query.error || (Object.keys(fieldErrors).length ? null : error)} onRetry={query.reload} />
      <table className="table-plain">
        <thead><tr><th>Job</th><th>Brings the role</th><th>For</th><th /></tr></thead>
        <tbody>
          {(query.data?.data ?? []).length === 0 ? (
            <tr><td colSpan={4} className="center-note">No jobs bring an access role yet.</td></tr>
          ) : (
            query.data.data.map((m) => (
              <tr key={m.id}>
                <td>{m.match_type === 'job_profile' ? `Job profile: ${profileName(m.match_value)}` : `Designation: ${m.match_value}`}</td>
                <td className="mono">{m.role_code}</td>
                <td>{m.scope === 'department' ? 'Their department' : 'The whole company'}</td>
                <td className="right"><button type="button" className="btn danger-outline small-btn" onClick={() => window.confirm('Stop this job bringing the role? People who got it from this job lose it.') && remove(m.id)}>Remove</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {canMap ? (
        <form onSubmit={add} style={{ marginTop: 12 }}>
          <div className="grid-2">
            <Field label="Match on" error={fieldErrors.match_type}>
              <select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value, match_value: '' })}>
                <option value="designation">Designation</option>
                <option value="job_profile">Job profile</option>
              </select>
            </Field>
            {form.match_type === 'job_profile' ? (
              <Field label="Job profile" required error={fieldErrors.match_value}>
                <select value={form.match_value} onChange={(e) => setForm({ ...form, match_value: e.target.value })}>
                  <option value="">Choose…</option>
                  {profileList.map((p) => <option key={p.id} value={p.id}>{p.job_code} · {p.title}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Designation" required hint="Exactly as it is written on the post, in any case." error={fieldErrors.match_value}>
                <input value={form.match_value} onChange={(e) => setForm({ ...form, match_value: e.target.value })} />
              </Field>
            )}
            <Field label="Role" required hint="The role’s code in Identity." error={fieldErrors.role_code}>
              {roles.length > 0 ? (
                <select value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })}>
                  <option value="">Choose…</option>
                  {roles.map((r) => <option key={r.id} value={r.code}>{r.name || r.code}</option>)}
                </select>
              ) : (
                <input value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} />
              )}
            </Field>
            <Field label="Applies to">
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="department">The post’s department</option>
                <option value="company">The whole company</option>
              </select>
            </Field>
          </div>
          <button className="btn" type="submit" disabled={saving || !form.match_value || !form.role_code} aria-busy={saving}>Add</button>
        </form>
      ) : (
        <p className="muted small">Adding one also needs permission to apply roles in Identity.</p>
      )}
    </div>
  )
}

function Delegations({ orgId }) {
  const { user } = useAuth()
  const { users, nameOf, canListUsers } = useUserNames(orgId)
  const query = useQuery(['role-change-delegations', orgId], ({ signal }) => getMyDelegations({ signal }), { enabled: Boolean(orgId) })
  const empty = { to_user_id: '', valid_from: todayISO(), valid_to: todayISO(), reason: '' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = getFieldErrors(error)

  const add = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createDelegation({ ...form, reason: form.reason.trim() || null })
      invalidate(['role-change-delegations', orgId])
      setForm(empty)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }
  const end = async (id) => {
    try {
      setError(null)
      await endDelegation(id)
      invalidate(['role-change-delegations', orgId])
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="panel">
      <h2 className="form-section" style={{ fontSize: 16 }}>My delegations</h2>
      <p className="muted small">While you are away, someone else can decide the role-change approvals you are named on. They must be able to approve role changes themselves.</p>
      <ErrorBanner error={query.error || (Object.keys(fieldErrors).length ? null : error)} onRetry={query.reload} />
      <table className="table-plain">
        <thead><tr><th>To</th><th>From</th><th>Until</th><th>Reason</th><th /></tr></thead>
        <tbody>
          {(query.data?.data ?? []).length === 0 ? (
            <tr><td colSpan={5} className="center-note">You have not delegated your approvals.</td></tr>
          ) : (
            query.data.data.map((d) => (
              <tr key={d.id}>
                <td>{nameOf(d.to_user_id, d.to_user_id.slice(0, 8))}</td>
                <td>{formatDate(d.valid_from)}</td>
                <td>{formatDate(d.valid_to)}</td>
                <td className="small">{d.reason}</td>
                <td className="right"><button type="button" className="btn secondary small-btn" onClick={() => end(d.id)}>End</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {canListUsers ? (
        <form onSubmit={add} style={{ marginTop: 12 }}>
          <div className="grid-2">
            <Field label="Delegate to" required error={fieldErrors.to_user_id}>
              <select value={form.to_user_id} onChange={(e) => setForm({ ...form, to_user_id: e.target.value })}>
                <option value="">Choose…</option>
                {users.filter((u) => u.id !== user?.id).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </Field>
            <Field label="Reason" error={fieldErrors.reason}>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={255} />
            </Field>
            <Field label="From" required error={fieldErrors.valid_from}>
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </Field>
            <Field label="Until (included)" required error={fieldErrors.valid_to}>
              <input type="date" value={form.valid_to} min={form.valid_from} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
            </Field>
          </div>
          <button className="btn" type="submit" disabled={saving || !form.to_user_id} aria-busy={saving}>Delegate</button>
        </form>
      ) : (
        <p className="muted small">Choosing someone needs permission to read users.</p>
      )}
    </div>
  )
}
