import { useState } from 'react'
import { projectsApi, risksApi } from '@/features/delivery/api.js'
import { RISK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const SCALE = [1, 2, 3, 4, 5]

export default function ProjectRisks({ orgId, project, names }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageProjects)
  const { data: risks = [], error, loading, refreshing, reload, setData } = useQuery(
    ['project', orgId, project.id, 'risks'],
    ({ signal }) => projectsApi.risks(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [busyId, setBusyId] = useState(null)
  const [changeError, setChangeError] = useState(null)

  // Highest score first, as the backend lists them.
  const store = (list) => setData([...list].sort((a, b) => b.score - a.score))

  async function changeStatus(risk, status) {
    setChangeError(null)
    setBusyId(risk.id)
    try {
      const saved = await risksApi.update(orgId, risk.id, { status })
      store(risks.map((r) => (r.id === saved.id ? saved : r)))
      invalidate(['project', orgId, project.id, 'summary'])
    } catch (err) {
      setChangeError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <ErrorBanner error={changeError || error} onRetry={changeError ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Risk</th>
              <th title="Probability × impact, each 1–5">Score</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={4} rows={3} />
            ) : risks.length === 0 ? (
              <tr><td colSpan={4} className="center-note">No risks recorded.</td></tr>
            ) : (
              risks.map((r) => (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    {r.mitigation && <div className="muted small">Mitigation: {r.mitigation}</div>}
                  </td>
                  <td>
                    <strong>{r.score}</strong> <span className="muted small">({r.probability} × {r.impact})</span>
                  </td>
                  <td>{names.personName(r.owner)}</td>
                  <td>
                    {canManage ? (
                      <select aria-label={`Status of ${r.title}`} value={r.status} disabled={busyId === r.id} onChange={(e) => changeStatus(r, e.target.value)}>
                        {Object.entries(RISK_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={r.status} label={RISK_STATUS_LABELS[r.status]} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {canManage && (
        <AddRisk
          orgId={orgId}
          project={project}
          names={names}
          onAdded={(risk) => {
            store([...risks, risk])
            invalidate(['project', orgId, project.id, 'summary'])
          }}
        />
      )}
    </>
  )
}

function AddRisk({ orgId, project, names, onAdded }) {
  const { user: me } = useAuth()
  const empty = { title: '', probability: 3, impact: 3, owner_user_id: me?.id || '', mitigation: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const people = names.people || [me].filter(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const body = {
        title: form.title.trim(),
        probability: Number(form.probability),
        impact: Number(form.impact),
        owner_user_id: form.owner_user_id,
      }
      if (form.mitigation.trim()) body.mitigation = form.mitigation.trim()
      onAdded(await projectsApi.addRisk(orgId, project.id, body))
      setForm(empty)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Record a risk</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="field">
        <label htmlFor="risk_title">What could go wrong *</label>
        <input id="risk_title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="risk_probability">How likely (1–5)</label>
          <select id="risk_probability" value={form.probability} onChange={(e) => set('probability', e.target.value)}>
            {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="risk_impact">How bad (1–5)</label>
          <select id="risk_impact" value={form.impact} onChange={(e) => set('impact', e.target.value)}>
            {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="risk_owner">Owner *</label>
          <select id="risk_owner" required value={form.owner_user_id} onChange={(e) => set('owner_user_id', e.target.value)}>
            <option value="">— Choose —</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="risk_mitigation">Mitigation</label>
        <textarea id="risk_mitigation" rows={2} value={form.mitigation} onChange={(e) => set('mitigation', e.target.value)} />
      </div>
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Add risk</button>
    </form>
  )
}
