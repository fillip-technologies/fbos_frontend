import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { contractsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import { CONTRACT_TYPES, PAYMENT_TRIGGERS, SUBJECTS, formatDateTime } from '@/features/sales/utils.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!orgId) return
    setError(null)
    contractsApi
      .get(orgId, id)
      .then(setContract)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, id])
  useEffect(load, [load])

  async function activate() {
    if (!window.confirm('Mark this contract as signed and active?')) return
    setError(null)
    setBusy(true)
    try {
      setContract(await contractsApi.activate(orgId, contract))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="center-note">Loading…</div>
  if (!contract)
    return (
      <div>
        <ErrorBanner error={error} onRetry={load} />
        <button className="btn secondary" onClick={() => navigate('/contracts')}>← Back</button>
      </div>
    )

  const canActivate =
    hasAccess(me, ACCESS.manageContracts) && ['draft', 'pending_signature'].includes(contract.status)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{contract.contract_no}</span> <StatusBadge status={contract.status} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <Link to={`/customers/${contract.client.id}`}>{contract.client.name}</Link>
            {contract.opportunity_id && (
              <>
                {' · '}
                <Link to={`/opportunities/${contract.opportunity_id}`}>Opportunity</Link>
              </>
            )}
            {contract.accepted_quotation_id && (
              <>
                {' · '}
                <Link to={`/quotations/${contract.accepted_quotation_id}`}>Accepted quotation</Link>
              </>
            )}
          </p>
        </div>
        <div className="row-actions">
          {canActivate && (
            <button className="btn" disabled={busy} onClick={activate}>Mark signed &amp; activate</button>
          )}
          <button className="btn secondary" onClick={() => navigate('/contracts')}>← Back</button>
        </div>
      </div>

      <ErrorBanner error={error} />
      <div className="panel">
        <div className="details-grid">
          <Detail label="Type">{CONTRACT_TYPES[contract.contract_type] || contract.contract_type}</Detail>
          <Detail label="Value">{formatMoney(contract.total_value)}</Detail>
          <Detail label="Starts">{formatDate(contract.start_date)}</Detail>
          <Detail label="Ends">{contract.end_date && formatDate(contract.end_date)}</Detail>
          <Detail label="Signed">{contract.signed_at && formatDateTime(contract.signed_at)}</Detail>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Payment schedule</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Share</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {contract.payment_terms.map((t) => (
              <tr key={t.seq} style={{ cursor: 'default' }}>
                <td>{t.seq}</td>
                <td>
                  {PAYMENT_TRIGGERS[t.trigger_type] || t.trigger_type}
                  {t.milestone_code && <span className="muted"> · {t.milestone_code}</span>}
                </td>
                <td>{t.percent != null ? `${t.percent}%` : formatMoney(t.amount)}</td>
                <td className="muted small">{t.due_offset_days} days after invoice</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasAccess(me, ACCESS.manageInvoices) && ['active', 'pending_signature'].includes(contract.status) && (
          <Link className="btn secondary small-btn" to={`/invoices/new?customer=${contract.client.id}&contract=${contract.id}`}>
            Raise invoice
          </Link>
        )}
      </div>

      {hasAccess(me, ACCESS.activities) && (
        <ActivityTimeline orgId={orgId} subjectType={SUBJECTS.contract} subjectId={contract.id} />
      )}
    </div>
  )
}
