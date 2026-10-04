import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { contractsApi, offeringsApi, opportunitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { formatMoney } from '@/features/customers/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { toIsoDate } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import ContractForm from '@/features/sales/components/ContractForm.jsx'
import QuotationItemsEditor, { newItem, rowsToItems } from '@/features/sales/components/QuotationItemsEditor.jsx'
import { LOST_REASONS, OPEN_STAGES, SUBJECTS, humanize } from '@/features/sales/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

const toForm = (o) => ({
  stage: o.stage,
  probability: String(o.probability),
  amount: String(Number(o.expected_value.amount)),
  expected_close_date: o.expected_close_date || '',
})

function inDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

function NewQuotation({ orgId, opportunityId, onCreated, onCancel }) {
  const [offerings, setOfferings] = useState(null)
  const [rows, setRows] = useState([newItem()])
  const [validUntil, setValidUntil] = useState(inDays(30))
  const [terms, setTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    offeringsApi.listAll(orgId).then(setOfferings).catch(setError)
  }, [orgId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { valid_until: validUntil, items: rowsToItems(rows, offerings) }
      if (terms.trim()) body.terms = terms.trim()
      onCreated(await opportunitiesApi.createQuotation(orgId, opportunityId, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>New quotation</h3>
      <ErrorBanner error={error} />
      {offerings === null ? (
        !error && <div className="center-note">Loading offerings…</div>
      ) : (
        <>
          <QuotationItemsEditor rows={rows} setRows={setRows} offerings={offerings} />
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="q-valid">Valid until *</label>
              <input id="q-valid" type="date" required value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="q-terms">Terms</label>
              <input id="q-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
        </>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving || !offerings?.length}>
          {saving ? 'Creating…' : 'Create draft'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

export default function OpportunityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const { ownerName } = useOwners(orgId)
  const canManage = hasAccess(me, ACCESS.manageOpportunities)
  const canSeeContracts = hasAccess(me, ACCESS.contracts)

  const [opp, setOpp] = useState(null)
  const [form, setForm] = useState(null)
  const [quotations, setQuotations] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // null | 'quotation' | 'lost' | 'contract'
  const [panel, setPanel] = useState(null)
  const [lost, setLost] = useState({ reason: 'price', competitor: '', note: '' })
  const fieldErrors = getFieldErrors(error)

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    Promise.all([
      opportunitiesApi.get(orgId, id),
      opportunitiesApi.quotations(orgId, id),
      canSeeContracts ? contractsApi.list(orgId, { opportunity_id: id, limit: 100 }) : { data: [] },
    ])
      .then(([o, q, c]) => {
        setOpp(o)
        setForm(toForm(o))
        setQuotations(q.data)
        setContracts(c.data)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id, canSeeContracts])
  useEffect(load, [load])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const original = toForm(opp)
      const body = {}
      if (form.stage !== original.stage) body.stage = form.stage
      if (form.probability !== original.probability) body.probability = Number(form.probability)
      if (form.amount !== original.amount) body.expected_value = { amount: Number(form.amount), currency: opp.expected_value.currency }
      if (form.expected_close_date !== original.expected_close_date) body.expected_close_date = form.expected_close_date
      if (Object.keys(body).length) {
        const updated = await opportunitiesApi.update(orgId, id, opp.version, body)
        setOpp(updated)
        setForm(toForm(updated))
      }
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function markLost(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { reason: lost.reason }
      if (lost.competitor.trim()) body.competitor = lost.competitor.trim()
      if (lost.note.trim()) body.note = lost.note.trim()
      const updated = await opportunitiesApi.markLost(orgId, id, opp.version, body)
      setOpp(updated)
      setForm(toForm(updated))
      setPanel(null)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (!opp)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <button className="btn secondary" onClick={() => navigate('/opportunities')}>← Back</button>
      </div>
    )

  const open = OPEN_STAGES.includes(opp.stage)
  const accepted = quotations.find((q) => q.status === 'accepted')
  const canCreateContract = accepted && contracts.length === 0 && hasAccess(me, ACCESS.manageContracts)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {opp.name} <StatusBadge status={opp.stage} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{opp.code}</span> · <Link to={`/customers/${opp.client.id}`}>{opp.client.name}</Link>
            {opp.lead_id && (
              <>
                {' · '}
                <Link to={`/leads/${opp.lead_id}`}>from lead</Link>
              </>
            )}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/opportunities')}>← Back</button>
      </div>

      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} onRetry={load} />}

      <div className="panel">
        {canManage && open ? (
          <form onSubmit={handleSave}>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="opp-stage">Stage</label>
                <select id="opp-stage" value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                  {OPEN_STAGES.map((s) => (
                    <option key={s} value={s}>{humanize(s)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="opp-prob">Probability %</label>
                <input
                  id="opp-prob"
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={(e) => set('probability', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="opp-close">Close by</label>
                <input
                  id="opp-close"
                  type="date"
                  value={form.expected_close_date}
                  onChange={(e) => set('expected_close_date', e.target.value)}
                />
              </div>
            </div>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="opp-amount">Expected value ({opp.expected_value.currency})</label>
                <input
                  id="opp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                />
              </div>
              <Detail label="Owner">{ownerName(opp.owner.id)}</Detail>
            </div>
            <div className="row-actions">
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              {!panel && (
                <button type="button" className="btn danger-outline" onClick={() => setPanel('lost')}>Mark lost…</button>
              )}
            </div>
          </form>
        ) : (
          <div className="details-grid">
            <Detail label="Expected value">{formatMoney(opp.expected_value)}</Detail>
            <Detail label="Probability">{opp.probability}%</Detail>
            <Detail label="Close by">{formatDate(opp.expected_close_date)}</Detail>
            <Detail label="Owner">{ownerName(opp.owner.id)}</Detail>
            {opp.lost_reason && <Detail label="Lost because">{opp.lost_reason}</Detail>}
          </div>
        )}

        {panel === 'lost' && (
          <form className="inline-panel" onSubmit={markLost}>
            <h3>Mark lost</h3>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="lost-reason">Reason</label>
                <select id="lost-reason" value={lost.reason} onChange={(e) => setLost((l) => ({ ...l, reason: e.target.value }))}>
                  {Object.entries(LOST_REASONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="lost-competitor">Competitor</label>
                <input
                  id="lost-competitor"
                  value={lost.competitor}
                  onChange={(e) => setLost((l) => ({ ...l, competitor: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="lost-note">Note</label>
                <input id="lost-note" value={lost.note} onChange={(e) => setLost((l) => ({ ...l, note: e.target.value }))} />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn danger" type="submit" disabled={saving}>Mark lost</button>
              <button type="button" className="btn secondary" onClick={() => setPanel(null)} disabled={saving}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="panel">
        <div className="section-head">
          <h2 style={{ fontSize: 17 }}>Quotations</h2>
          {canManage && open && panel !== 'quotation' && !quotations.some((q) => q.status !== 'superseded' && q.status !== 'rejected') && (
            <button className="btn small-btn" onClick={() => setPanel('quotation')}>+ New quotation</button>
          )}
        </div>
        {panel === 'quotation' && (
          <NewQuotation
            orgId={orgId}
            opportunityId={opp.id}
            onCreated={(q) => navigate(`/quotations/${q.id}`)}
            onCancel={() => setPanel(null)}
          />
        )}
        {quotations.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No quotations yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Status</th>
                <th>Total</th>
                <th>Valid until</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="mono">{q.quote_no} · rev {q.revision_no}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td>{formatMoney(q.totals.grand_total)}</td>
                  <td>{formatDate(q.valid_until)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canSeeContracts && (accepted || contracts.length > 0) && (
        <div className="panel">
          <div className="section-head">
            <h2 style={{ fontSize: 17 }}>Contract</h2>
            {canCreateContract && panel !== 'contract' && (
              <button className="btn small-btn" onClick={() => setPanel('contract')}>Create contract</button>
            )}
          </div>
          {panel === 'contract' && (
            <ContractForm
              orgId={orgId}
              quotation={accepted}
              onCreated={(c) => navigate(`/contracts/${c.id}`)}
              onCancel={() => setPanel(null)}
            />
          )}
          {contracts.length === 0 ? (
            panel !== 'contract' && <p className="muted small" style={{ margin: 0 }}>The quotation was accepted. Create the contract next.</p>
          ) : (
            contracts.map((c) => (
              <p key={c.id} style={{ margin: 0 }}>
                <Link to={`/contracts/${c.id}`} className="mono">{c.contract_no}</Link> <StatusBadge status={c.status} />{' '}
                <span className="muted small">{formatMoney(c.total_value)}</span>
              </p>
            ))
          )}
        </div>
      )}

      {hasAccess(me, ACCESS.activities) && (
        <ActivityTimeline orgId={orgId} subjectType={SUBJECTS.opportunity} subjectId={opp.id} />
      )}
    </div>
  )
}
