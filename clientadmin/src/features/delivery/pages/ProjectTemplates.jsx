import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { toUpperCode } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/

// The company's project templates: what a new project can start with (its phases and
// milestones). A template shows on the New project form once a version of it is published.
export default function ProjectTemplates() {
  const navigate = useNavigate()
  const { orgId, activeOrg } = useActiveOrg()
  const enabled = Boolean(orgId)
  const names = useDeliveryNames(orgId)
  const { data: templates = [], error, loading, reload } = useQuery(
    ['project-templates', orgId],
    ({ signal }) => setupApi.templates(orgId, { signal }),
    { enabled }
  )
  const { data: types = [] } = useLookup(['project-types', orgId], ({ signal }) => setupApi.projectTypes(orgId, { signal }), { enabled })
  const [creating, setCreating] = useState(false)
  const typeName = (code) => types.find((t) => t.code === code)?.name || code

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Project templates</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The phases and milestones a new project in {activeOrg ? `“${activeOrg.name}”` : 'this company'} can start with.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {!creating && <button className="btn" onClick={() => setCreating(true)}>+ New template</button>}
        </div>
      </div>

      {creating && <NewTemplate orgId={orgId} types={types} names={names} onClose={() => setCreating(false)} />}

      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Template</th>
              <th>Kind of project</th>
              <th>Vertical</th>
              <th>In use</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={5} rows={3} />
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="center-note">
                  No templates yet. Make one for work you deliver again and again, so its projects start with their phases and milestones.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} onClick={() => navigate(`/project-templates/${encodeURIComponent(t.code)}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div className="muted small mono">{t.code}</div>
                  </td>
                  <td>{typeName(t.work_unit_type_code)}</td>
                  <td>{t.vertical ? names.verticalName(t.vertical) : <span className="muted">Any</span>}</td>
                  <td>
                    {t.published_version_no ? (
                      `Version ${t.published_version_no}`
                    ) : (
                      <span className="muted">Not published: hidden from New project</span>
                    )}
                  </td>
                  <td><StatusBadge status={t.status} label={t.status === 'retired' ? 'Retired' : 'Active'} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NewTemplate({ orgId, types, names, onClose }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', code: '', codeEdited: false, work_unit_type_code: 'project', vertical_id: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const codeProblem = form.code && !CODE_PATTERN.test(form.code) ? 'Use letters, digits, - and _ only.' : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (codeProblem) return
    setError(null)
    setBusy(true)
    try {
      const created = await setupApi.createTemplate(orgId, {
        code: form.code,
        name: form.name.trim(),
        work_unit_type_code: form.work_unit_type_code,
        ...(form.vertical_id ? { vertical_id: form.vertical_id } : {}),
      })
      invalidate(['project-templates', orgId])
      navigate(`/project-templates/${encodeURIComponent(created.code)}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>New template</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="tpl_name">Name *</label>
          <input
            id="tpl_name"
            required
            maxLength={255}
            placeholder="e.g. Website build"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, ...(f.codeEdited ? {} : { code: toUpperCode(e.target.value) }) }))}
          />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="tpl_code">Code *</label>
          <input
            id="tpl_code"
            className="mono-input"
            required
            maxLength={100}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value, codeEdited: true }))}
          />
          {(codeProblem || fieldErrors.code) && <div className="field-error">{codeProblem || fieldErrors.code}</div>}
          <div className="hint">Can’t be changed later.</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="tpl_type">Kind of project *</label>
          <select id="tpl_type" required value={form.work_unit_type_code} onChange={(e) => set('work_unit_type_code', e.target.value)}>
            {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
          <div className="hint">The template is offered for this kind only.</div>
        </div>
        <div className="field">
          <label htmlFor="tpl_vertical">Vertical</label>
          <select id="tpl_vertical" value={form.vertical_id} onChange={(e) => set('vertical_id', e.target.value)}>
            <option value="">— Any —</option>
            {(names.verticals || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="hint">Filled in on projects made from it when they have none.</div>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Create and add phases</button>
        <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
