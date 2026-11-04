import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ACCESS, hasAccess, isClientAdmin } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'
import { expensesApi } from '@/features/finance/api.js'
import Detail from '@/features/finance/components/Detail.jsx'
import ExpenseForm, { ExpenseDecisionDialog } from '@/features/finance/components/ExpenseForm.jsx'
import { APPROVAL_LABELS, money, PAYMENT_BADGE, PAYMENT_LABELS } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { todayIso } from '@/shared/utils/dates.js'

export default function ExpenseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const query = useQuery(['finance-expense', orgId, id], ({ signal }) => expensesApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const [dialog, setDialog] = useState(null) // 'edit' | 'approve' | 'reject'
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(false)
  const expense = query.data

  if (query.error && !expense) return <ErrorBanner error={query.error} onRetry={query.reload} />
  if (!expense) return <DetailSkeleton lines={8} />

  const canWrite = hasAccess(user, ACCESS.manageExpenses)
  // Nobody decides an expense they recorded (the backend's rule); a client admin may.
  const recordedByMe = expense.created_by === user?.id && !isClientAdmin(user)
  const canDecide = expense.approval_status === 'pending_approval' && hasAccess(user, ACCESS.approveExpenses) && !recordedByMe

  function saved(next) {
    query.setData(next)
    invalidate(['finance-expenses', orgId])
    setDialog(null)
  }

  async function run(action) {
    setWorking(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err)
    } finally {
      setWorking(false)
    }
  }

  const markPaid = () => run(async () => saved(await expensesApi.update(orgId, expense.id, { payment_status: 'paid', paid_on: todayIso() })))
  const remove = () => {
    if (!window.confirm('Delete this expense? It is removed from every total.')) return
    run(async () => {
      await expensesApi.remove(orgId, expense.id)
      invalidate(['finance-expenses', orgId])
      navigate('/expenses')
    })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{expense.description}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {expense.category?.name} · {formatDate(expense.expense_date)}{' '}
            <StatusBadge status={expense.approval_status} label={APPROVAL_LABELS[expense.approval_status]} />{' '}
            <StatusBadge status={PAYMENT_BADGE[expense.payment_status]} label={PAYMENT_LABELS[expense.payment_status]} />
          </p>
        </div>
        <div className="row-actions">
          {canDecide && <button className="btn" onClick={() => setDialog('approve')}>Approve</button>}
          {canDecide && <button className="btn danger-outline" onClick={() => setDialog('reject')}>Reject</button>}
          {canWrite && expense.payment_status === 'unpaid' && expense.approval_status === 'approved' && (
            <button className="btn secondary" onClick={markPaid} disabled={working} aria-busy={working}>Mark paid today</button>
          )}
          {canWrite && <button className="btn secondary" onClick={() => setDialog('edit')}>Edit</button>}
        </div>
      </div>

      <ErrorBanner error={error} />
      {expense.approval_status === 'pending_approval' && recordedByMe && (
        <div className="alert info">This expense is above the approval limit. Someone else with approval access decides it.</div>
      )}
      {expense.approval_status === 'rejected' && (
        <div className="alert warn">Rejected{expense.decision_comment ? `: ${expense.decision_comment}` : ''}. Editing it sends it for approval again.</div>
      )}

      <div className="panel">
        <div className="details-grid">
          <Detail label="Amount before tax">{money(expense.amount, expense.currency)}</Detail>
          <Detail label="Tax">{money(expense.tax_amount, expense.currency)}</Detail>
          <Detail label="Total">{money(expense.total, expense.currency)}</Detail>
          <Detail label="Paid to">{expense.vendor_name}</Detail>
          <Detail label="Paid on">{expense.paid_on && formatDate(expense.paid_on)}</Detail>
          <Detail label="Payment reference">{expense.payment_reference && <span className="mono">{expense.payment_reference}</span>}</Detail>
          <Detail label="Related project">{expense.work_unit_id && <Link to={`/projects/${expense.work_unit_id}`}>Open project</Link>}</Detail>
          <Detail label="Department or branch">{expense.org_unit_id && <Link to={`/org-units/${expense.org_unit_id}`}>Open unit</Link>}</Detail>
          <Detail label="Decided">{expense.decided_at && `${formatDate(expense.decided_at.slice(0, 10))}${expense.decision_comment ? ` · ${expense.decision_comment}` : ''}`}</Detail>
          <Detail label="Notes">{expense.notes}</Detail>
        </div>
      </div>

      <DocumentPanel orgId={orgId} subjectType={DOCUMENT_SUBJECTS.expense} subjectId={expense.id} canAttach={canWrite}
        title="Bills & receipts" emptyText="No bill or receipt attached yet." />

      {canWrite && (
        <div className="danger-zone">
          <h3>Delete expense</h3>
          <p className="muted small" style={{ marginTop: 0 }}>Removes it from every total. To keep a record, reject or edit it instead.</p>
          <button className="btn danger-outline" onClick={remove} disabled={working}>Delete</button>
        </div>
      )}

      {dialog === 'edit' && <ExpenseForm orgId={orgId} expense={expense} onClose={() => setDialog(null)} onSaved={saved} />}
      {(dialog === 'approve' || dialog === 'reject') && (
        <ExpenseDecisionDialog orgId={orgId} expense={expense} decision={dialog} onClose={() => setDialog(null)} onDecided={saved} />
      )}
    </div>
  )
}
