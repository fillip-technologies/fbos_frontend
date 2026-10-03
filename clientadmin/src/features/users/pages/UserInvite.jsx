import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usersApi } from '@/features/users/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import AccessEditor, { EMPTY_ACCESS } from '@/features/access/components/AccessEditor.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import { toRequestAccess } from '@/features/access/permissions.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { formatDateTime, INVITABLE_USER_TYPES } from '@/features/users/utils.js'

const EMPTY_PROFILE = {
  name: '',
  email: '',
  phone: '',
  employee_code: '',
  user_type: 'employee',
  home_unit_id: null,
  manager_user_id: '',
}

const blankToNull = (v) => (v && v.trim() ? v.trim() : null)

export default function UserInvite() {
  const navigate = useNavigate()
  const { orgId, activeOrg } = useActiveOrg()
  const { catalog, roles, units, loading: catalogLoading, error: catalogError, reload } = useAccessCatalog(orgId)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [access, setAccess] = useState(EMPTY_ACCESS)
  const [managers, setManagers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  // Possible managers: everyone in the org who isn't deactivated.
  useEffect(() => {
    if (!orgId) return
    setProfile((p) => ({ ...p, home_unit_id: null, manager_user_id: '' }))
    setAccess(EMPTY_ACCESS)
    usersApi
      .list(orgId, { limit: 100 })
      .then((res) => setManagers(res.data.filter((u) => u.status !== 'deactivated')))
      .catch(() => setManagers([]))
  }, [orgId])

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const created = await usersApi.invite(orgId, {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: blankToNull(profile.phone),
        employee_code: blankToNull(profile.employee_code),
        user_type: profile.user_type,
        home_unit_id: profile.home_unit_id || null,
        manager_user_id: profile.manager_user_id || null,
        ...toRequestAccess(access),
      })
      navigate(`/users/${created.id}`, {
        state: {
          notice: `Invitation emailed to ${created.email}. The activation link is valid until ${formatDateTime(created.invitation_expires_at)}.`,
        },
      })
    } catch (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (field) => (fieldErrors[field] ? 'invalid' : '')
  const fieldError = (field) => fieldErrors[field] && <div className="field-error">{fieldErrors[field]}</div>
  const hasProfileErrors = ['name', 'email', 'phone', 'employee_code', 'user_type', 'home_unit_id', 'manager_user_id'].some(
    (f) => fieldErrors[f]
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invite a user</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            They get an email with a link to set their password. The link works once and expires after 72 hours.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          <Link className="btn secondary" to="/users">← Back</Link>
        </div>
      </div>

      {error && !hasProfileErrors && <ErrorBanner error={error} />}
      {error && hasProfileErrors && <div className="alert error">Please fix the highlighted fields.</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel form-section">
          <h2>1. Who are you inviting?</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="name">Full name *</label>
              <input id="name" className={inputClass('name')} value={profile.name} onChange={(e) => set('name', e.target.value)} required maxLength={255} />
              {fieldError('name')}
            </div>
            <div className="field">
              <label htmlFor="email">Work email *</label>
              <input id="email" type="email" className={inputClass('email')} value={profile.email} onChange={(e) => set('email', e.target.value)} required />
              <div className="hint">They sign in with this address.</div>
              {fieldError('email')}
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" className={inputClass('phone')} placeholder="+91 98350 12345" value={profile.phone} onChange={(e) => set('phone', e.target.value)} />
              {fieldError('phone')}
            </div>
            <div className="field">
              <label htmlFor="employee_code">Employee code</label>
              <input id="employee_code" className={inputClass('employee_code')} placeholder="FT-0142" value={profile.employee_code} onChange={(e) => set('employee_code', e.target.value)} />
              <div className="hint">Optional. Unique within the organization.</div>
              {fieldError('employee_code')}
            </div>
          </div>
        </div>

        <div className="panel form-section">
          <h2>2. Type and place in {activeOrg ? activeOrg.name : 'the organization'}</h2>
          <div className="type-cards">
            {INVITABLE_USER_TYPES.map((t) => (
              <label key={t.value} className={`type-card${profile.user_type === t.value ? ' selected' : ''}`}>
                <input type="radio" name="user_type" value={t.value} checked={profile.user_type === t.value} onChange={() => set('user_type', t.value)} />
                <b>{t.label}</b>
                <span className="muted small">{t.help}</span>
              </label>
            ))}
          </div>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor="home_unit">Home unit</label>
              <UnitSelect id="home_unit" className={inputClass('home_unit_id')} units={units} value={profile.home_unit_id} emptyLabel="— Not placed in a unit —" onChange={(id) => set('home_unit_id', id)} />
              <div className="hint">
                {units.length ? 'The team or department they belong to.' : 'This organization has no units yet.'}
              </div>
              {fieldError('home_unit_id')}
            </div>
            <div className="field">
              <label htmlFor="manager">Reports to</label>
              <select id="manager" className={inputClass('manager_user_id')} value={profile.manager_user_id} onChange={(e) => set('manager_user_id', e.target.value)}>
                <option value="">— No manager —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email}){m.status === 'invited' ? ' · invited' : ''}
                  </option>
                ))}
              </select>
              {fieldError('manager_user_id')}
            </div>
          </div>
        </div>

        <div className="panel form-section">
          <h2>3. What can they do?</h2>
          <p className="muted small" style={{ marginTop: -6 }}>
            Access is set per user. Start from a role preset, adjust individual permissions, and limit each one to a unit if needed.
          </p>
          <ErrorBanner error={catalogError} onRetry={reload} />
          {catalogLoading ? (
            <div className="center-note">Loading permissions…</div>
          ) : (
            <AccessEditor catalog={catalog} roles={roles} units={units} value={access} onChange={setAccess} fieldErrors={fieldErrors} />
          )}
        </div>

        <div className="sticky-actions">
          <Link className="btn secondary" to="/users">Cancel</Link>
          <button className="btn" type="submit" disabled={saving || !orgId}>
            {saving ? 'Sending invitation…' : 'Send invitation'}
          </button>
        </div>
      </form>
    </div>
  )
}
