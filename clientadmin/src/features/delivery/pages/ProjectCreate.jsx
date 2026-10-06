import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { projectsApi, setupApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { PROJECT_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'

export default function ProjectCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const enabled = Boolean(orgId)
  const { data: types = [] } = useLookup(['project-types', orgId], ({ signal }) => setupApi.projectTypes(orgId, { signal }), { enabled })
  const { data: templates = [] } = useLookup(['project-templates', orgId], ({ signal }) => setupApi.templates(orgId, { signal }), { enabled })

  // Opened from a contract: the project delivers it, for its customer.
  const contractId = params.get('contract') || ''
  const [form, setForm] = useState({
    work_unit_type_code: params.get('customer') ? 'project' : 'internal',
    template_code: '',
    name: '',
    objective: '',
    client_id: params.get('customer') || '',
    manager_user_id: me?.id || '',
    owning_unit_id: '',
    vertical_id: '',
    planned_start: todayIso(),
    planned_end: '',
    priority: 'medium',
    billable: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const projectType = types.find((t) => t.code === form.work_unit_type_code)
  const typeTemplates = templates.filter(
    (t) => t.work_unit_type_code === form.work_unit_type_code && t.status === 'active' && t.published_version_no
  )
  const managers = names.people || [me].filter(Boolean)
  const units = (names.units || []).filter((u) => u.status !== 'inactive')

  function chooseType(code) {
    setForm((f) => ({ ...f, work_unit_type_code: code, template_code: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        name: form.name.trim(),
        owning_unit_id: form.owning_unit_id,
        manager_user_id: form.manager_user_id,
        planned_start: form.planned_start,
        planned_end: form.planned_end,
        priority: form.priority,
        billable: form.billable,
        ...(form.template_code ? { template_code: form.template_code } : { work_unit_type_code: form.work_unit_type_code }),
      }
      if (form.objective.trim()) body.objective = form.objective.trim()
      if (form.client_id) body.client_id = form.client_id
      if (contractId) body.contract_id = contractId
      if (form.vertical_id) body.vertical_id = form.vertical_id
      const created = await projectsApi.create(orgId, body)
      invalidate(['projects', orgId])
      navigate(`/projects/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New project</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      {contractId && <div className="alert info">This project delivers a contract; its customer is filled in.</div>}
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <form className="panel" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="work_unit_type_code">Kind of project *</label>
            <select id="work_unit_type_code" required value={form.work_unit_type_code} onChange={(e) => chooseType(e.target.value)}>
              {types.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="template_code">Template</label>
            <select id="template_code" value={form.template_code} onChange={(e) => set('template_code', e.target.value)}>
              <option value="">— Start empty —</option>
              {typeTemplates.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
            <div className="hint">A template adds its phases and milestones.</div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="name">Name *</label>
          <input id="name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="objective">Objective</label>
          <textarea id="objective" rows={2} value={form.objective} onChange={(e) => set('objective', e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="client_id">Customer{projectType?.requires_client ? ' *' : ''}</label>
            <select
              id="client_id"
              required={Boolean(projectType?.requires_client)}
              value={form.client_id}
              onChange={(e) => set('client_id', e.target.value)}
            >
              <option value="">{projectType?.requires_client ? '— Choose —' : '— None (internal) —'}</option>
              {(names.customers || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vertical_id">Vertical</label>
            <select id="vertical_id" value={form.vertical_id} onChange={(e) => set('vertical_id', e.target.value)}>
              <option value="">— None —</option>
              {(names.verticals || []).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="manager_user_id">Project manager *</label>
            <select id="manager_user_id" required value={form.manager_user_id} onChange={(e) => set('manager_user_id', e.target.value)}>
              <option value="">— Choose —</option>
              {managers.map((u) => (
                <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="owning_unit_id">Delivering team *</label>
            <select id="owning_unit_id" required value={form.owning_unit_id} onChange={(e) => set('owning_unit_id', e.target.value)}>
              <option value="">— Choose —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {names.units?.length === 0 && <div className="hint">No branches, departments or teams yet. Add them under Company structure.</div>}
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label htmlFor="planned_start">Starts *</label>
            <input id="planned_start" type="date" required value={form.planned_start} onChange={(e) => set('planned_start', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="planned_end">Due *</label>
            <input
              id="planned_end"
              type="date"
              required
              min={form.planned_start}
              value={form.planned_end}
              onChange={(e) => set('planned_end', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-check">
          <input type="checkbox" checked={form.billable} onChange={(e) => set('billable', e.target.checked)} />
          Billable to the customer
        </label>

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>Create project</button>
        </div>
      </form>
    </div>
  )
}
