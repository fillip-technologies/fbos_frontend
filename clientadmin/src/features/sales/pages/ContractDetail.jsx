import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { contractsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import ActivityTimeline from '@/features/sales/components/ActivityTimeline.jsx'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'
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
  const {
    data: contract,
    error: loadError,
    loading,
    reload,
    setData,
  } = useQuery(['contract', orgId, id], ({ signal }) => contractsApi.get(orgId, id, { signal }), {
    enabled: Boolean(orgId),
  })
  // Saves a changed contract into the cache; its list is refetched on the next visit.
  const setContract = (next) => {
    setData(next)
    invalidate(['contracts', orgId])
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save(change) {
    setError(null)
    setBusy(true)
    try {
      setContract(await change())
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function activate() {
    if (!window.confirm('Activate this contract? Delivery and billing start from it.')) return
    await save(() => contractsApi.activate(orgId, contract))
  }

  if (loading) return <DetailSkeleton />
  if (!contract)
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/contracts')}>← Back</button>
      </div>
    )

  const signable = ['draft', 'pending_signature'].includes(contract.status)
  const canManage = hasAccess(me, ACCESS.manageContracts)
  const canActivate = canManage && signable
  const hasSignedCopy = Boolean(contract.signed_document_id)
  // A finished contract keeps its files but takes no new ones (the backend enforces it too).
  const canAttach =
    canManage && hasAccess(me, ACCESS.uploadDocuments) && !['completed', 'terminated', 'expired'].includes(contract.status)

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
            <button
              className="btn"
              disabled={busy || !hasSignedCopy}
              title={hasSignedCopy ? undefined : 'Attach the signed copy first'}
              onClick={activate}
            >
              Activate
            </button>
          )}
          {/* Delivery, linked by route only: the project form reads the customer and contract. */}
          {hasAccess(me, ACCESS.manageProjects) && ['active', 'pending_signature'].includes(contract.status) && (
            <Link className="btn secondary" to={`/projects/new?customer=${contract.client.id}&contract=${contract.id}`}>
              Start project
            </Link>
          )}
          <button className="btn secondary" onClick={() => navigate('/contracts')}>← Back</button>
        </div>
      </div>

      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />
      <div className="panel">
        <div className="details-grid">
          <Detail label="Type">{CONTRACT_TYPES[contract.contract_type] || contract.contract_type}</Detail>
          <Detail label="Value">{formatMoney(contract.total_value)}</Detail>
          <Detail label="Starts">{formatDate(contract.start_date)}</Detail>
          <Detail label="Ends">{contract.end_date && formatDate(contract.end_date)}</Detail>
          <Detail label="Signed">{contract.signed_at && formatDateTime(contract.signed_at)}</Detail>
        </div>
        {canActivate && !hasSignedCopy && (
          <p className="muted small" style={{ margin: '12px 0 0' }}>
            Upload the signed contract below and mark it as the signed copy; then it can be activated.
          </p>
        )}
      </div>

      {hasAccess(me, ACCESS.documents) && (
        <DocumentPanel
          orgId={orgId}
          subjectType={DOCUMENT_SUBJECTS.contract}
          subjectId={contract.id}
          canAttach={canAttach}
          defaultCategory="contract"
          linkRole={signable && !hasSignedCopy ? 'signed_copy' : 'attachment'}
          rowAction={(doc) =>
            doc.id === contract.signed_document_id ? (
              <span className="chip">Signed copy</span>
            ) : (
              canManage &&
              signable && (
                <button
                  type="button"
                  className="btn secondary small-btn"
                  disabled={busy}
                  onClick={() => save(() => contractsApi.setSignedDocument(orgId, contract, doc.id))}
                >
                  Use as signed copy
                </button>
              )
            )
          }
        />
      )}

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
