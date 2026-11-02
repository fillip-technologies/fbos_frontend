import { useEffect, useMemo, useState } from 'react'
import { getPositions, getRoleOptions, getWorkerPosts, getWorkers, previewRoleChange, requestRoleChange } from '../api.js'
import { POST_TYPE_LABELS, formatCurrency, formatShare, toList, todayISO } from '../utils.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import UnitSelect from '@/features/access/components/UnitSelect.jsx'
import useAccessCatalog from '@/features/access/useAccessCatalog.js'
import FormDialog from './FormDialog.jsx'
import RolePicker from './RolePicker.jsx'
import Field from './Field.jsx'
import { AccessImpact, ApprovalRoute } from './RoleChangeRoute.jsx'
import useUserNames from '../useUserNames.js'

// What the form can do. "change" is a promotion, demotion, transfer or correction of one post.
const ACTIONS = [
  ['change', 'Change a post'],
  ['add_post', 'Add a post'],
  ['end_post', 'End a post'],
  ['make_primary', 'Make a post primary'],
]
const CHANGE_TYPES = [
  ['promotion', 'Promotion'],
  ['demotion', 'Demotion'],
  ['transfer', 'Transfer (same level, new team or manager)'],
  ['correction', 'Correction (fix a wrong title or reporting line)'],
]
const NEW_POST_TYPES = ['concurrent', 'additional_charge', 'acting']
const PREVIEW_DELAY_MS = 500

const emptyForm = (preset) => ({
  action: preset?.action || 'change',
  change_type: 'promotion',
  post_ref: preset?.postRef || '',
  post_type: 'concurrent',
  effective_date: todayISO(),
  end_date: '',
  reason: '',
  new_designation: '',
  new_unit_id: null,
  new_manager_id: '',
  new_position_id: '',
  new_annual_ctc: '',
  new_time_share: '',
  new_monthly_allowance: '',
})

// The request body for the form as it stands, or null while it does not yet say what changes.
function buildBody(form, target, roleDraft) {
  const body = {
    change_type: form.action === 'change' ? form.change_type : form.action,
    effective_date: form.effective_date,
    reason: form.reason.trim() || 'Preview',
  }
  if (form.action === 'end_post' || form.action === 'make_primary') {
    return form.post_ref ? { ...body, post_ref: form.post_ref } : null
  }
  if (form.new_designation.trim()) body.new_designation = form.new_designation.trim()
  if (roleDraft !== null) body.new_role_codes = roleDraft.map(({ role_code, scope, unit_id }) => ({ role_code, scope, ...(unit_id ? { unit_id } : {}) }))
  if (form.new_unit_id) body.new_unit_id = form.new_unit_id
  if (form.new_manager_id) body.new_manager_id = form.new_manager_id
  if (form.new_position_id) body.new_position_id = form.new_position_id
  if (form.new_time_share !== '') body.new_time_share = Number(form.new_time_share)
  if (form.new_monthly_allowance !== '') body.new_monthly_allowance = Number(form.new_monthly_allowance)
  if (form.action === 'add_post') {
    body.post_type = form.post_type
    if (form.end_date) body.end_date = form.end_date
    return body.new_designation || body.new_role_codes?.length ? body : null
  }
  if (target && target.post_type !== 'primary') body.post_ref = target.post_ref
  if (form.new_annual_ctc !== '' && (!target || target.post_type === 'primary')) body.new_annual_ctc = Number(form.new_annual_ctc)
  const changesSomething = ['new_designation', 'new_role_codes', 'new_unit_id', 'new_manager_id', 'new_position_id', 'new_annual_ctc', 'new_time_share', 'new_monthly_allowance']
    .some((field) => body[field] !== undefined)
  return changesSomething ? body : null
}

// Change what a person's posts are: promote, move, add, end, or swap the primary one. Someone else approves it
// (more people for some changes); the preview shows who, and which access roles it adds or removes.
export default function RoleChangeDialog({ worker, salary, units, preset = null, onClose, onSaved }) {
  const { orgId } = useActiveOrg()
  const { nameOf } = useUserNames(orgId)
  // A post's title is a role from Identity (the names "Add employee" and "Add from users" use). Reading roles
  // needs its own permission: without it the field stays a text box so nobody is blocked.
  const { roles } = useAccessCatalog(orgId)
  const roleNames = roles.map((role) => role.name || role.code)
  const [form, setForm] = useState(() => emptyForm(preset))
  // null: the roles stay as they are; a list is the complete set the post gives afterwards.
  const [roleDraft, setRoleDraft] = useState(null)
  const [roleOptions, setRoleOptions] = useState([])
  const [posts, setPosts] = useState([])
  const [workers, setWorkers] = useState([])
  const [positions, setPositions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const fieldErrors = getFieldErrors(error)
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  // Seats can be shared, so say how much of each is left; a full one can only be chosen with finance's approval.
  const seatLabel = (p) => {
    const free = Number(p.budgeted_fte) - Number(p.used_fte || 0)
    return `${p.position_code} - ${p.title} (${free > 0 ? `${Math.round(free * 100) / 100} FTE free` : 'full: needs finance to go over'})`
  }
  const unitName = (id) => (units || []).find((u) => u.id === id)?.name || 'another department'

  useEffect(() => {
    getWorkers({ limit: 100 }).then((res) => setWorkers(toList(res).filter((w) => w.id !== worker.id && w.status !== 'exited'))).catch(() => {})
    getRoleOptions().then((res) => setRoleOptions(toList(res))).catch(() => {})
    getPositions({ limit: 100 }).then((res) => setPositions(toList(res).filter((p) => p.hiring_status !== 'frozen'))).catch(() => {})
    getWorkerPosts(worker.id)
      .then((res) => {
        const live = toList(res)
        setPosts(live)
        setForm((prev) => (prev.post_ref ? prev : { ...prev, post_ref: live.find((p) => p.post_type === 'primary')?.post_ref || '' }))
      })
      .catch(() => {})
  }, [worker.id])

  const target = posts.find((p) => p.post_ref === form.post_ref) || null
  const targetIsPrimary = !target || target.post_type === 'primary'
  const currentRoles = form.action === 'add_post' ? [] : target?.role_codes || []
  const shownRoles = roleDraft ?? currentRoles
  // Ticking back to what the post gives now changes nothing, so it is not sent.
  const sameAsNow = roleDraft !== null && roleDraft.length === currentRoles.length && roleDraft.every((spec) => currentRoles.some((now) => now.role_code.toLowerCase() === spec.role_code.toLowerCase() && now.scope === spec.scope && (now.unit_id || null) === (spec.unit_id || null)))
  const sentRoles = sameAsNow ? null : roleDraft
  const body = useMemo(() => buildBody(form, target, sentRoles), [form, target, sentRoles])
  const bodyKey = JSON.stringify(body)

  // Show what the request would set in motion, once it says what changes; saves nothing.
  useEffect(() => {
    if (!body) {
      setPreview(null)
      setPreviewError(null)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setPreviewing(true)
      try {
        const result = await previewRoleChange(worker.id, body)
        if (!cancelled) {
          setPreview(result)
          setPreviewError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(err)
        }
      } finally {
        if (!cancelled) setPreviewing(false)
      }
    }, PREVIEW_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bodyKey, worker.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const request = buildBody(form, target, sentRoles)
    if (!request) {
      setError(new Error('Say what changes first.'))
      return
    }
    try {
      setSaving(true)
      setError(null)
      await requestRoleChange(worker.id, { ...request, reason: form.reason.trim() })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const future = form.effective_date > todayISO()
  // Someone with a login has the designation of their role in Identity: it is not set here, and another post
  // cannot take its place as the primary one.
  const fromIdentity = Boolean(worker.user_id)
  const actions = fromIdentity ? ACTIONS.filter(([value]) => value !== 'make_primary') : ACTIONS
  const isChange = form.action === 'change'
  const isAdd = form.action === 'add_post'
  const needsPost = form.action !== 'add_post'
  const postChoices = form.action === 'make_primary' ? posts.filter((p) => p.post_type === 'concurrent') : form.action === 'end_post' ? posts.filter((p) => p.post_type !== 'primary') : posts
  const postLabel = (p) => `${p.title} (${POST_TYPE_LABELS[p.post_type]}${p.time_share != null ? `, ${formatShare(p.time_share)}` : ''})`
  const sharesTime = isAdd ? form.post_type === 'concurrent' : target?.post_type === 'concurrent'

  return (
    <FormDialog
      wide
      title={`Change role: ${worker.name || `${worker.first_name} ${worker.last_name}`}`}
      intro={`Fill in only what changes. Others must approve it; ${future ? 'it then applies on the effective date' : 'a past or current date applies as soon as it is approved'}. A new post does not start until it is approved.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Send for approval"
      savingLabel="Sending..."
      saving={saving}
      error={error}
    >
      <div className="grid-2">
        <Field label="What to do">
          <select value={form.action} onChange={(e) => { setRoleDraft(null); set({ action: e.target.value, post_ref: e.target.value === 'add_post' ? '' : form.post_ref }) }}>
            {actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {isChange && (
          <Field label="Type" error={fieldErrors.change_type}>
            <select value={form.change_type} onChange={(e) => set({ change_type: e.target.value })}>
              {CHANGE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        )}
        {needsPost && (
          <Field label="Which post" error={fieldErrors.post_ref} hint={postChoices.length === 0 ? 'No post fits this: ending needs an extra post, making primary needs a concurrent one.' : undefined}>
            <select value={form.post_ref} onChange={(e) => { setRoleDraft(null); set({ post_ref: e.target.value }) }}>
              {!isChange && <option value="">Choose a post</option>}
              {postChoices.map((p) => <option key={p.post_ref} value={p.post_ref}>{postLabel(p)}</option>)}
            </select>
          </Field>
        )}
        {isAdd && (
          <Field label="Kind of post" error={fieldErrors.post_type}>
            <select value={form.post_type} onChange={(e) => set({ post_type: e.target.value })}>
              {NEW_POST_TYPES.map((type) => <option key={type} value={type}>{POST_TYPE_LABELS[type]}</option>)}
            </select>
          </Field>
        )}
        <Field label={isAdd ? 'Starts on' : form.action === 'end_post' ? 'Ends on' : 'Effective date'} required hint="Past dates are fine." error={fieldErrors.effective_date}>
          <input type="date" value={form.effective_date} onChange={(e) => set({ effective_date: e.target.value })} />
        </Field>
        {(isChange || isAdd) && (
          <>
            {!(fromIdentity && !isAdd && targetIsPrimary) && (
            <Field
              label={isAdd ? 'Title' : 'New designation'}
              required={isAdd && !fromIdentity}
              hint={fromIdentity && isAdd ? 'Optional: left empty, the title is the name of the role.' : !isAdd && target ? `Now: ${target.title}` : undefined}
              error={fieldErrors.new_designation}
            >
              {roleNames.length > 0 ? (
                <select
                  value={form.new_designation}
                  onChange={(e) => set({ new_designation: e.target.value })}
                >
                  <option value="">{isAdd ? 'Choose a role…' : 'No change'}</option>
                  {roleNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.new_designation}
                  onChange={(e) => set({ new_designation: e.target.value })}
                />
              )}
            </Field>
            )}
            {fromIdentity && (
              <Field
                label="Roles (their access)"
                full
                hint={isAdd ? 'The post gives these roles while it lasts.' : 'Their title is the name of their role. Pick the complete set the post gives after this change; leave it alone to keep it.'}
                error={fieldErrors.new_role_codes}
              >
                <RolePicker options={roleOptions} value={shownRoles} current={currentRoles} onChange={setRoleDraft} unitName={unitName} />
              </Field>
            )}
            {units?.length > 0 && (
              <div className="field">
                <label htmlFor="rc-unit">{isAdd ? 'Department' : 'New department'}</label>
                <UnitSelect id="rc-unit" units={units} value={form.new_unit_id} onChange={(v) => set({ new_unit_id: v })} emptyLabel={isAdd ? 'None' : 'No change'} />
                {fieldErrors.new_unit_id && <div className="field-error">{fieldErrors.new_unit_id}</div>}
              </div>
            )}
            <Field label={isAdd ? 'Reports to' : 'New manager'} error={fieldErrors.new_manager_id}>
              <select value={form.new_manager_id} onChange={(e) => set({ new_manager_id: e.target.value })}>
                <option value="">{isAdd ? 'Nobody' : 'No change'}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.worker_code ? `${w.worker_code} - ` : ''}{w.first_name} {w.last_name}</option>
                ))}
              </select>
            </Field>
            <Field label={isAdd ? 'Position seat' : 'New position seat'} hint="A seat can be shared until its budget is used. Going over needs finance. An old seat gets its share back." error={fieldErrors.new_position_id}>
              <select value={form.new_position_id} onChange={(e) => set({ new_position_id: e.target.value })}>
                <option value="">{isAdd ? 'No seat' : 'No change'}</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{seatLabel(p)}</option>
                ))}
              </select>
            </Field>
            {(sharesTime || (isChange && target?.post_type === 'primary')) && (
              <Field label="Share of working time (%)" hint={isChange ? `Now: ${target?.time_share != null ? formatShare(target.time_share) : 'the rest'}` : 'Primary and concurrent posts add up to at most 100%.'} error={fieldErrors.new_time_share}>
                <input type="number" min="1" max="100" step="1" value={form.new_time_share} onChange={(e) => set({ new_time_share: e.target.value })} />
              </Field>
            )}
            {(isAdd || !targetIsPrimary) && (
              <Field label="Monthly allowance" hint="Paid while the post is active." error={fieldErrors.new_monthly_allowance}>
                <input type="number" min="0" step="100" value={form.new_monthly_allowance} onChange={(e) => set({ new_monthly_allowance: e.target.value })} />
              </Field>
            )}
            {isAdd && (
              <Field label="Planned end" hint="Optional, e.g. for an acting post." error={fieldErrors.end_date}>
                <input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
              </Field>
            )}
            {isChange && salary && targetIsPrimary && (
              <Field
                label={`New annual package (${salary.currency})`}
                hint={`Now ${formatCurrency(salary.annual_ctc, salary.currency)}. ${form.change_type === 'promotion' ? 'A promotion cannot reduce it.' : form.change_type === 'demotion' ? 'A demotion cannot increase it.' : ''} Pay belongs to the person, not to an extra post.`}
                error={fieldErrors.new_annual_ctc}
              >
                <input type="number" min="0" step="1000" value={form.new_annual_ctc} onChange={(e) => set({ new_annual_ctc: e.target.value })} />
              </Field>
            )}
          </>
        )}
      </div>
      <Field label="Reason" required error={fieldErrors.reason} full>
        <textarea rows={3} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Why is this change being made?" />
      </Field>

      {(preview || previewError || previewing) && (
        <div className="preview-panel" aria-live="polite">
          {previewError && <div className="small">This can’t be requested yet: {friendlyMessage(previewError)}</div>}
          {preview && (
            <>
              <h3>Who approves it</h3>
              <ApprovalRoute steps={preview.steps} nameOf={nameOf} />
              <h3 style={{ marginTop: 12 }}>Access it changes</h3>
              <AccessImpact impact={preview.access_impact} unitName={unitName} />
            </>
          )}
          {previewing && !preview && !previewError && <div className="muted small">Checking…</div>}
        </div>
      )}
    </FormDialog>
  )
}
