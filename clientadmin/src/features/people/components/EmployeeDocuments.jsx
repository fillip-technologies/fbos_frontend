import { useEffect, useRef, useState } from 'react'
import {
  getOnboarding,
  getOnboardingRequirements,
  rejectWorkerDocument,
  revealDocumentNumber,
  saveOnboardingRequirements,
  saveWorkerDocument,
  verifyWorkerDocument,
} from '../api.js'
import { DOC_STATUS_LABELS, formatDate } from '../utils.js'
import { documentCategoriesApi, documentsApi, DOCUMENT_SUBJECTS, uploadDocument } from '@/features/documents/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import FormDialog from './FormDialog.jsx'
import Field from './Field.jsx'

const REVEAL_SECONDS = 15
// ID scans go in the restricted "employee_record" category when the organization has it, else the general one.
const PREFERRED_CATEGORY = 'employee_record'
const FALLBACK_CATEGORY = 'attachment'

// Documents tab: the onboarding checklist with each ID number, its dates, the scanned file and verification.
export default function EmployeeDocuments({ orgId, workerId, canManage, canReveal, onOpenBank }) {
  const [onboarding, setOnboarding] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [editing, setEditing] = useState(null) // the checklist item being edited
  const [rejecting, setRejecting] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [revealed, setRevealed] = useState({}) // code -> full number, shown for a few seconds
  const timers = useRef({})

  const load = async () => {
    try {
      setLoadError(null)
      setOnboarding(await getOnboarding(workerId))
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
      setOnboarding(await action())
    } catch (err) {
      setActionError(err)
    }
  }

  const reveal = async (code) => {
    try {
      setActionError(null)
      const { value } = await revealDocumentNumber(workerId, code)
      setRevealed((prev) => ({ ...prev, [code]: value }))
      clearTimeout(timers.current[code])
      timers.current[code] = setTimeout(() => setRevealed(({ [code]: _gone, ...rest }) => rest), REVEAL_SECONDS * 1000)
    } catch (err) {
      setActionError(err)
    }
  }

  const openFile = async (item) => {
    try {
      setActionError(null)
      const { url } = await documentsApi.downloadUrl(orgId, item.document_id, 1)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setActionError(err)
    }
  }

  if (!onboarding) {
    return (
      <div>
        <ErrorBanner error={loadError} onRetry={load} />
        {!loadError && <div className="panel center-note">Loading documents...</div>}
      </div>
    )
  }

  const { items, required_total: total, required_done: done, complete } = onboarding
  const percent = total ? Math.round((done / total) * 100) : 100

  return (
    <div>
      <ErrorBanner error={actionError} />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Onboarding {done} of {total} verified {complete && <span className="badge active">complete</span>}
            </h2>
            <div className="muted small">Required items must be verified before the file counts as complete.</div>
          </div>
          {canManage && (
            <button type="button" className="btn secondary small-btn" onClick={() => setSettingsOpen(true)}>
              Checklist settings
            </button>
          )}
        </div>
        <div className="progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      </div>

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-plain">
          <thead>
            <tr>
              <th>Document</th>
              <th>Number</th>
              <th>Valid till</th>
              <th>File</th>
              <th>Status</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code}>
                <td>
                  <strong>{item.label}</strong>
                  {item.required && <span className="muted small"> · required</span>}
                  {item.name_on_document && <div className="muted small">Name: {item.name_on_document}</div>}
                  {item.status === 'rejected' && item.rejection_reason && (
                    <div className="small amount-neg">Rejected: {item.rejection_reason}</div>
                  )}
                </td>
                <td>
                  {item.kind === 'bank' ? (
                    <span className="muted">See Bank tab</span>
                  ) : !item.number_label ? (
                    <span className="muted">—</span>
                  ) : revealed[item.code] ? (
                    <span className="id-number">{revealed[item.code]}</span>
                  ) : item.has_number ? (
                    <span className="id-number">{item.number_masked || 'Saved'}</span>
                  ) : (
                    <span className="muted">Not entered</span>
                  )}
                  {item.has_number && canReveal && !revealed[item.code] && (
                    <button type="button" className="btn secondary small-btn" style={{ marginLeft: 8 }} onClick={() => reveal(item.code)}>
                      Show
                    </button>
                  )}
                </td>
                <td>{item.has_expiry && item.expires_on ? formatDate(item.expires_on) : <span className="muted">—</span>}</td>
                <td>
                  {item.document_id ? (
                    <button type="button" className="btn secondary small-btn" onClick={() => openFile(item)}>
                      View
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <StatusBadge
                    status={item.status === 'uploaded' ? 'to_verify' : item.status === 'pending' ? 'missing' : item.status}
                    label={DOC_STATUS_LABELS[item.status]}
                  />
                </td>
                <td className="right">
                  <div className="table-actions">
                    {item.kind === 'bank' ? (
                      <button type="button" className="btn secondary small-btn" onClick={onOpenBank}>
                        Open bank
                      </button>
                    ) : (
                      canManage && (
                        <>
                          <button type="button" className="btn secondary small-btn" onClick={() => setEditing(item)}>
                            {item.status === 'pending' ? 'Add' : 'Edit'}
                          </button>
                          {(item.status === 'uploaded' || item.status === 'rejected') && (
                            <button
                              type="button"
                              className="btn small-btn"
                              onClick={() => act(() => verifyWorkerDocument(workerId, item.code))}
                            >
                              Verify
                            </button>
                          )}
                          {item.status === 'uploaded' && (
                            <button type="button" className="btn danger-outline small-btn" onClick={() => setRejecting(item)}>
                              Reject
                            </button>
                          )}
                        </>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <DocumentDialog
          orgId={orgId}
          workerId={workerId}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setOnboarding(next)
            setEditing(null)
          }}
        />
      )}
      {rejecting && (
        <RejectDialog
          item={rejecting}
          workerId={workerId}
          onClose={() => setRejecting(null)}
          onDone={(next) => {
            setOnboarding(next)
            setRejecting(null)
          }}
        />
      )}
      {settingsOpen && (
        <RequirementsDialog
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function DocumentDialog({ orgId, workerId, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    document_number: '',
    name_on_document: item.name_on_document || '',
    issued_on: item.issued_on || '',
    expires_on: item.expires_on || '',
    issuing_authority: item.issuing_authority || '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const body = {
        name_on_document: form.name_on_document.trim() || null,
        issued_on: form.issued_on || null,
        issuing_authority: form.issuing_authority.trim() || null,
      }
      if (item.has_expiry) body.expires_on = form.expires_on || null
      // Leaving the number empty keeps the saved one; typing a new one replaces it.
      if (item.number_label && form.document_number.trim()) body.document_number = form.document_number.trim()
      if (file) {
        const categories = (await documentCategoriesApi.list(orgId))?.data ?? []
        const categoryCode = categories.some((c) => c.code === PREFERRED_CATEGORY) ? PREFERRED_CATEGORY : FALLBACK_CATEGORY
        const saved = await uploadDocument(orgId, file, {
          categoryCode,
          title: `${item.label}`,
          subjectType: DOCUMENT_SUBJECTS.employee,
          subjectId: workerId,
          linkRole: item.code,
        })
        body.document_id = saved.id
        body.file_name = file.name
      }
      onSaved(await saveWorkerDocument(workerId, item.code, body))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      wide
      title={item.label}
      intro="Saving sends the document back for verification."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save"
      saving={saving}
      error={error}
    >
      <div className="grid-2">
        {item.number_label && (
          <Field
            label={item.number_label}
            hint={item.has_number ? `Saved (${item.number_masked || 'hidden'}). Leave empty to keep it.` : undefined}
            error={fieldErrors.document_number}
          >
            <input
              type="text"
              autoComplete="off"
              className="upper"
              value={form.document_number}
              onChange={(e) => setForm({ ...form, document_number: e.target.value })}
              autoFocus
            />
          </Field>
        )}
        <Field label="Name on document" error={fieldErrors.name_on_document}>
          <input type="text" value={form.name_on_document} onChange={(e) => setForm({ ...form, name_on_document: e.target.value })} />
        </Field>
        <Field label="Issued on" error={fieldErrors.issued_on}>
          <input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
        </Field>
        {item.has_expiry && (
          <Field label="Valid till" error={fieldErrors.expires_on}>
            <input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
          </Field>
        )}
        <Field label="Issued by" error={fieldErrors.issuing_authority}>
          <input type="text" value={form.issuing_authority} onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })} />
        </Field>
        <Field
          label="Scanned file"
          full
          hint={item.document_id ? `Current file: ${item.file_name || 'attached'}. Choose another to replace it.` : 'PDF or image.'}
          error={fieldErrors.document_id}
        >
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
      </div>
    </FormDialog>
  )
}

function RejectDialog({ item, workerId, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      onDone(await rejectWorkerDocument(workerId, item.code, reason.trim()))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      title={`Reject ${item.label}`}
      intro="Say what is wrong so it can be fixed."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Reject"
      saving={saving}
      error={error}
    >
      <Field label="Reason" required error={fieldErrors.reason}>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scan is blurry" autoFocus />
      </Field>
    </FormDialog>
  )
}

function RequirementsDialog({ onClose, onSaved }) {
  const [items, setItems] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOnboardingRequirements().then((res) => setItems(res.items)).catch(setError)
  }, [])

  const toggle = (code) =>
    setItems((prev) => prev.map((i) => (i.code === code ? { ...i, required: !i.required } : i)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await saveOnboardingRequirements(items.filter((i) => i.required).map((i) => i.code))
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      title="Checklist settings"
      intro="Tick what every employee must have verified. This applies to the whole organization."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save"
      saving={saving}
      error={error}
    >
      {!items ? (
        <div className="center-note">Loading...</div>
      ) : (
        items.map((i) => (
          <div key={i.code} className="field check-field" style={{ marginBottom: 8 }}>
            <label htmlFor={`req-${i.code}`}>
              <input id={`req-${i.code}`} type="checkbox" checked={i.required} onChange={() => toggle(i.code)} />
              {i.label}
            </label>
          </div>
        ))
      )}
    </FormDialog>
  )
}
