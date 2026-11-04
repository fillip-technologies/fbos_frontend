import { useState } from 'react'
import { expenseCategoriesApi, expensesApi, financeSettingsApi } from '@/features/finance/api.js'
import { amountOrNull, changedFields, money, NOT_HERE, num } from '@/features/finance/utils.js'
import { orgUnitsApi } from '@/features/org-units/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { DELIVERY } from '@/shared/api/paths.js'
import { listAll } from '@/shared/api/query.js'
import { useLookup } from '@/shared/api/useQuery.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'

const toForm = (e) => ({
  category_id: e?.category?.id ?? '',
  description: e?.description ?? '',
  vendor_name: e?.vendor_name ?? '',
  expense_date: e?.expense_date ?? todayIso(),
  amount: e?.amount ?? '',
  tax_amount: e?.tax_amount ?? '0',
  currency: e?.currency ?? '',
  payment_status: e?.payment_status ?? 'unpaid',
  paid_on: e?.paid_on ?? '',
  payment_reference: e?.payment_reference ?? '',
  work_unit_id: e?.work_unit_id ?? '',
  org_unit_id: e?.org_unit_id ?? '',
  notes: e?.notes ?? '',
})

// The body the backend takes: empty optional fields as null, money as strings.
function toBody(form) {
  return {
    ...form,
    vendor_name: form.vendor_name.trim() || null,
    description: form.description.trim(),
    amount: amountOrNull(form.amount),
    tax_amount: amountOrNull(form.tax_amount) ?? '0',
    currency: form.currency.trim().toUpperCase() || null,
    paid_on: form.payment_status === 'paid' ? form.paid_on || null : null,
    payment_reference: form.payment_status === 'paid' ? form.payment_reference.trim() || null : null,
    work_unit_id: form.work_unit_id || null,
    org_unit_id: form.org_unit_id || null,
    notes: form.notes.trim() || null,
  }
}

// Record a new expense, or edit one (`expense`). Saving an edit sends only what changed.
export default function ExpenseForm({ orgId, expense, onClose, onSaved }) {
  const editing = Boolean(expense)
  const [form, setForm] = useState(() => toForm(expense))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fields = getFieldErrors(error)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const categories = useLookup(['finance-categories', orgId], ({ signal }) => expenseCategoriesApi.list(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const settings = useLookup(['finance-settings', orgId], ({ signal }) => financeSettingsApi.get(orgId, { signal }), { enabled: Boolean(orgId) })
  const units = useLookup(['org-units', orgId, 'all'], ({ signal }) => orgUnitsApi.listAll(orgId, { signal }), { enabled: Boolean(orgId) })
  // Same key and fetcher as the task form's project picker; without project access it is left out.
  const projects = useLookup(['projects', orgId, 'options'], ({ signal }) => listAll(`${DELIVERY}/work-units`, orgId, {}, { signal }), { enabled: Boolean(orgId) })

  const currency = form.currency || expense?.currency || settings.data?.default_currency || 'INR'
  const threshold = settings.data?.expense_approval_threshold
  const total = num(form.amount) + num(form.tax_amount)
  const willWait = threshold !== null && threshold !== undefined && total > num(threshold)
  // A category switched off since this expense was recorded is still shown for it.
  const categoryOptions = [...(categories.data ?? [])]
  if (expense?.category && !categoryOptions.some((c) => c.id === expense.category.id)) categoryOptions.push(expense.category)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = toBody(form)
      const saved = editing ? await expensesApi.update(orgId, expense.id, changedFields(toBody(toForm(expense)), body)) : await expensesApi.create(orgId, body)
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title={editing ? 'Edit expense' : 'Record an expense'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {!editing && <p className="hint" style={{ marginTop: 0 }}>{NOT_HERE}</p>}
        <ErrorBanner error={error} />
        <div className="grid-2">
          <div className="field">
            <label htmlFor="x-category">Category</label>
            <select id="x-category" value={form.category_id} onChange={set('category_id')} required>
              <option value="" disabled>Choose…</option>
              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {fields.category_id && <div className="field-error">{fields.category_id}</div>}
          </div>
          <div className="field">
            <label htmlFor="x-date">Date of the expense</label>
            <input id="x-date" type="date" value={form.expense_date} onChange={set('expense_date')} required />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="x-description">What was it for?</label>
            <input id="x-description" value={form.description} onChange={set('description')} maxLength={500} required placeholder="e.g. October office rent, Delhi" />
          </div>
          <div className="field">
            <label htmlFor="x-vendor">Paid to (vendor)</label>
            <input id="x-vendor" value={form.vendor_name} onChange={set('vendor_name')} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="x-currency">Currency</label>
            <input id="x-currency" value={form.currency} onChange={set('currency')} maxLength={3} placeholder={settings.data?.default_currency ?? 'INR'} />
            <div className="hint">Leave empty for the company’s currency.</div>
          </div>
          <div className="field">
            <label htmlFor="x-amount">Amount before tax</label>
            <input id="x-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
            {fields.amount && <div className="field-error">{fields.amount}</div>}
          </div>
          <div className="field">
            <label htmlFor="x-tax">Tax (GST etc.)</label>
            <input id="x-tax" type="number" min="0" step="0.01" inputMode="decimal" value={form.tax_amount} onChange={set('tax_amount')} />
          </div>
          <div className="field">
            <label htmlFor="x-paid">Paid?</label>
            <select id="x-paid" value={form.payment_status} onChange={set('payment_status')}>
              <option value="unpaid">Not paid yet</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {form.payment_status === 'paid' && (
            <>
              <div className="field">
                <label htmlFor="x-paid-on">Paid on</label>
                <input id="x-paid-on" type="date" value={form.paid_on} onChange={set('paid_on')} />
                <div className="hint">Empty: the date of the expense.</div>
              </div>
              <div className="field">
                <label htmlFor="x-ref">Payment reference</label>
                <input id="x-ref" value={form.payment_reference} onChange={set('payment_reference')} maxLength={120} placeholder="UTR, cheque no." />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="x-unit">Department or branch</label>
            <select id="x-unit" value={form.org_unit_id} onChange={set('org_unit_id')}>
              <option value="">Not for one unit</option>
              {(units.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {(projects.data || form.work_unit_id) && (
            <div className="field">
              <label htmlFor="x-project">Related project</label>
              <select id="x-project" value={form.work_unit_id} onChange={set('work_unit_id')}>
                <option value="">No project</option>
                {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="hint">For overheads tied to a project. The project’s own delivery costs go in its cost entries.</div>
            </div>
          )}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="x-notes">Notes</label>
            <textarea id="x-notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        {form.amount && (
          <p className="muted small">
            Total {money(total, currency)}
            {willWait && ` · above the approval limit of ${money(threshold, currency)}, so it waits for someone else to approve it`}
          </p>
        )}
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Record expense'}</button>
        </div>
      </form>
    </Dialog>
  )
}

// Approve or reject an expense waiting for approval (a rejection says why).
export function ExpenseDecisionDialog({ orgId, expense, decision, onClose, onDecided }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const rejecting = decision === 'reject'

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onDecided(await expensesApi.decide(orgId, expense.id, { decision, comment: comment.trim() || null }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title={rejecting ? 'Reject expense' : 'Approve expense'} onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <p style={{ marginTop: 0 }}>{expense.description} · {money(expense.total, expense.currency)}</p>
        <div className="field">
          <label htmlFor="d-comment">{rejecting ? 'Why is it rejected?' : 'Comment (optional)'}</label>
          <textarea id="d-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required={rejecting} />
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className={`btn${rejecting ? ' danger' : ''}`} disabled={saving} aria-busy={saving}>{rejecting ? 'Reject' : 'Approve'}</button>
        </div>
      </form>
    </Dialog>
  )
}

