import { useEffect, useRef, useState } from 'react'
import {
  createBankAccount,
  deactivateBankAccount,
  getBankAccounts,
  makePrimaryBankAccount,
  revealBankAccountNumber,
  updateBankAccount,
  verifyBankAccount,
} from '../api.js'
import { formatDate, statusLabel } from '../utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const REVEAL_SECONDS = 15

const emptyForm = (holder = '') => ({
  account_holder_name: holder,
  bank_name: '',
  branch: '',
  account_number: '',
  ifsc: '',
  account_type: 'savings',
  upi_id: '',
  is_primary: false,
})

// Bank tab: the accounts an employee can be paid into. One is primary; changing a number or IFSC
// sends the account back for verification.
export default function EmployeeBank({ workerId, workerName, canManage, canReveal, onChanged }) {
  const [accounts, setAccounts] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [dialog, setDialog] = useState(null) // 'new' or the account being edited
  const [revealed, setRevealed] = useState({})
  const timers = useRef({})

  const load = async () => {
    try {
      setLoadError(null)
      setAccounts(await getBankAccounts(workerId))
    } catch (err) {
      setLoadError(err)
    }
  }

  useEffect(() => {
    load()
    return () => Object.values(timers.current).forEach(clearTimeout)
  }, [workerId])

  const act = async (action) => {
    try {
      setActionError(null)
      await action()
      await load()
      onChanged?.()
    } catch (err) {
      setActionError(err)
    }
  }

  const reveal = async (account) => {
    try {
      setActionError(null)
      const { value } = await revealBankAccountNumber(workerId, account.id)
      setRevealed((prev) => ({ ...prev, [account.id]: value }))
      clearTimeout(timers.current[account.id])
      timers.current[account.id] = setTimeout(
        () => setRevealed(({ [account.id]: _gone, ...rest }) => rest),
        REVEAL_SECONDS * 1000,
      )
    } catch (err) {
      setActionError(err)
    }
  }

  const deactivate = (account) => {
    if (!window.confirm(`Deactivate the ${account.bank_name} account? It can no longer be used for payment.`)) return
    act(() => deactivateBankAccount(workerId, account.id))
  }

  if (!accounts) {
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={load} />
        {!loadError && <div className="panel center-note">Loading bank accounts...</div>}
      </div>
    )
  }

  return (
    <div>
      <ErrorBanner error={actionError} />
      <div className="page-head">
        <div>
          <h2 className="section-title">Bank accounts</h2>
          <div className="muted small">Salary is paid to the primary verified account.</div>
        </div>
        {canManage && (
          <button type="button" className="btn" onClick={() => setDialog('new')}>
            + Add account
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="panel center-note">No bank account yet.</div>
      ) : (
        <div className="cards">
          {accounts.map((a) => (
            <div key={a.id} className="panel" style={a.status === 'inactive' ? { opacity: 0.6 } : undefined}>
              <div className="section-head">
                <strong>{a.bank_name}</strong>
                <span className="row-actions">
                  {a.is_primary && <span className="chip">Primary</span>}
                  <StatusBadge status={a.status} label={statusLabel(a.status)} />
                </span>
              </div>
              <div className="id-number">{revealed[a.id] || a.account_masked}</div>
              <div className="muted small">
                {a.account_holder_name} · {a.account_type} · IFSC {a.ifsc}
                {a.branch ? ` · ${a.branch}` : ''}
              </div>
              {a.upi_id && <div className="muted small">UPI {a.upi_id}</div>}
              {a.verified_at && <div className="muted small">Verified {formatDate(a.verified_at)}</div>}
              <div className="row-actions wrap" style={{ marginTop: 12 }}>
                {canReveal && !revealed[a.id] && (
                  <button type="button" className="btn secondary small-btn" onClick={() => reveal(a)}>
                    Show number
                  </button>
                )}
                {canManage && a.status !== 'inactive' && (
                  <>
                    {a.status === 'pending' && (
                      <button type="button" className="btn small-btn" onClick={() => act(() => verifyBankAccount(workerId, a.id))}>
                        Verify
                      </button>
                    )}
                    {!a.is_primary && (
                      <button type="button" className="btn secondary small-btn" onClick={() => act(() => makePrimaryBankAccount(workerId, a.id))}>
                        Make primary
                      </button>
                    )}
                    <button type="button" className="btn secondary small-btn" onClick={() => setDialog(a)}>
                      Edit
                    </button>
                    {!a.is_primary && (
                      <button type="button" className="btn danger-outline small-btn" onClick={() => deactivate(a)}>
                        Deactivate
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <BankDialog
          workerId={workerId}
          account={dialog === 'new' ? null : dialog}
          holder={workerName}
          isFirst={accounts.length === 0}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            load()
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}

function BankDialog({ workerId, account, holder, isFirst, onClose, onSaved }) {
  const editing = Boolean(account)
  const [form, setForm] = useState(
    editing
      ? { ...emptyForm(), account_holder_name: account.account_holder_name, bank_name: account.bank_name, branch: account.branch || '', ifsc: account.ifsc, account_type: account.account_type, upi_id: account.upi_id || '' }
      : emptyForm(holder),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const body = {
        account_holder_name: form.account_holder_name.trim(),
        bank_name: form.bank_name.trim(),
        branch: form.branch.trim() || null,
        ifsc: form.ifsc.trim(),
        account_type: form.account_type,
        upi_id: form.upi_id.trim() || null,
      }
      if (editing) {
        // Leaving the number empty keeps the saved one.
        if (form.account_number.trim()) body.account_number = form.account_number.trim()
        await updateBankAccount(workerId, account.id, body)
      } else {
        await createBankAccount(workerId, { ...body, account_number: form.account_number.trim(), is_primary: form.is_primary })
      }
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      wide
      title={editing ? 'Edit bank account' : 'Add bank account'}
      intro={editing ? 'Changing the holder, number or IFSC sends the account back for verification.' : undefined}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save account"
      saving={saving}
      error={error}
    >
      <div className="grid-2">
        <Field label="Account holder" required error={fieldErrors.account_holder_name}>
          <input type="text" value={form.account_holder_name} onChange={(e) => set({ account_holder_name: e.target.value })} autoFocus />
        </Field>
        <Field label="Bank" required error={fieldErrors.bank_name}>
          <input type="text" value={form.bank_name} onChange={(e) => set({ bank_name: e.target.value })} placeholder="e.g. HDFC Bank" />
        </Field>
        <Field
          label="Account number"
          required={!editing}
          hint={editing ? `Saved (${account.account_masked}). Leave empty to keep it.` : '9 to 18 digits'}
          error={fieldErrors.account_number}
        >
          <input type="text" inputMode="numeric" autoComplete="off" value={form.account_number} onChange={(e) => set({ account_number: e.target.value })} />
        </Field>
        <Field label="IFSC" required hint="11 characters, like HDFC0001234" error={fieldErrors.ifsc}>
          <input type="text" className="upper" value={form.ifsc} onChange={(e) => set({ ifsc: e.target.value })} maxLength={11} />
        </Field>
        <Field label="Branch" error={fieldErrors.branch}>
          <input type="text" value={form.branch} onChange={(e) => set({ branch: e.target.value })} />
        </Field>
        <Field label="Account type" error={fieldErrors.account_type}>
          <select value={form.account_type} onChange={(e) => set({ account_type: e.target.value })}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </select>
        </Field>
        <Field label="UPI ID" error={fieldErrors.upi_id}>
          <input type="text" value={form.upi_id} onChange={(e) => set({ upi_id: e.target.value })} placeholder="name@bank" />
        </Field>
      </div>
      {!editing && !isFirst && (
        <div className="field check-field">
          <label htmlFor="bank-primary">
            <input id="bank-primary" type="checkbox" checked={form.is_primary} onChange={(e) => set({ is_primary: e.target.checked })} />
            Make this the primary account
          </label>
        </div>
      )}
    </FormDialog>
  )
}
