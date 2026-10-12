import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formFieldsApi, verticalsApi } from '@/features/verticals/api.js'
import { formByCode, loadInputOptions, VERTICAL_INPUT } from '@/features/verticals/forms.js'
import FieldRowsEditor from '@/features/verticals/components/FieldRowsEditor.jsx'
import { rowError, toField, toRow } from '@/features/verticals/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { CHOICE_TYPES, fieldTypeLabel } from '@/shared/utils/customFields.js'

const orList = (words) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`)

// One form's custom fields, edited as one list and saved whole: the form shows them at once.
export default function FormFields() {
  const { form: code } = useParams()
  const form = formByCode(code)
  const { user } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canEdit = hasAccess(user, ACCESS.editFormFields)
  const enabled = Boolean(orgId && form?.ready)

  const query = useQuery(['form-fields', orgId, code], ({ signal }) => formFieldsApi.get(orgId, code, { signal }), { enabled })
  const verticalsQuery = useLookup(
    ['verticals', orgId, 'options'],
    ({ signal }) => verticalsApi.list(orgId, {}, { signal }).catch(() => []),
    { enabled }
  )
  const optionsQuery = useLookup(['form-rule-options', orgId, code], ({ signal }) => loadInputOptions(form, orgId, { signal }), {
    enabled,
  })

  const [draft, setDraft] = useState(null) // { revision, rows } once something was changed
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  const baseRows = useMemo(() => (query.data?.fields ?? []).map(toRow), [query.data])
  const rows = draft?.rows ?? baseRows
  const optionsByInput = useMemo(
    () => ({
      ...(optionsQuery.data ?? {}),
      [VERTICAL_INPUT]: (verticalsQuery.data ?? []).map((v) => ({
        value: v.id,
        label: v.status === 'active' ? v.name : `${v.name} (archived)`,
      })),
    }),
    [optionsQuery.data, verticalsQuery.data]
  )

  if (!form || !form.ready) return <Unavailable code={code} form={form} />

  const errors = Object.fromEntries(rows.map((row) => [row.rowKey, rowError(row, rows)]))
  const hasErrors = Object.values(errors).some(Boolean)
  const someoneSaved = Boolean(draft && query.data && query.data.revision !== draft.revision)
  const notes = query.data?.notes ?? []

  // The save quotes the revision the edit started from, never a newer one fetched meanwhile.
  const edit = (nextRows) => {
    setNotice('')
    setDraft((current) => ({ revision: current?.revision ?? query.data.revision, rows: nextRows }))
  }
  const discard = () => {
    setDraft(null)
    setError(null)
  }

  async function save() {
    setError(null)
    setNotice('')
    setSaving(true)
    try {
      const saved = await formFieldsApi.save(orgId, code, draft.revision, rows.map(toField))
      query.setData(saved)
      setDraft(null)
      invalidate(['custom-fields', orgId])
      invalidate(['record-fields', orgId])
      setNotice(`Saved. ${form.name} forms show these fields now.`)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="small"><Link to="/custom-fields">← Custom fields</Link></div>
          <h1>{form.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Shown on: {form.screens}{activeOrg ? ` in “${activeOrg.name}”` : ''}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={discard} />
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {notes.length > 0 && (
        <div className="alert info">
          Some older fields were left out because another list has a field with the same key:
          <ul style={{ margin: '6px 0 0' }}>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      )}
      {someoneSaved && (
        <div className="alert info">
          Someone else saved this form while you were editing, so your save would be refused. Discard your changes to see theirs.
        </div>
      )}

      <div className={`panel role-card${draft ? ' editing' : ''}`}>
        <div className="section-head">
          <div>
            <h2>Fields</h2>
            {form.inputs.length > 0 && (
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                A field can show only for some values of {orList(form.inputs.map((input) => input.label))}.
              </p>
            )}
          </div>
        </div>

        {query.error ? (
          <ErrorBanner error={query.error} onRetry={query.reload} />
        ) : query.loading ? (
          <PanelSkeleton lines={3} />
        ) : canEdit ? (
          <>
            {rows.length === 0 && <p className="muted">No custom fields on this form yet.</p>}
            <FieldRowsEditor rows={rows} onChange={edit} errors={errors} inputs={form.inputs} optionsByInput={optionsByInput} />
            <ErrorBanner error={error} />
            <div className="row-actions" style={{ marginTop: 14 }}>
              <button className="btn" type="button" onClick={save} disabled={!draft || hasErrors || saving} aria-busy={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {draft && (
                <button className="btn secondary" type="button" onClick={discard} disabled={saving}>Discard changes</button>
              )}
            </div>
          </>
        ) : (
          <FieldsTable fields={query.data.fields} inputs={form.inputs} optionsByInput={optionsByInput} />
        )}
      </div>
    </div>
  )
}

// For people who may see the fields but not change them.
function FieldsTable({ fields, inputs, optionsByInput }) {
  if (!fields.length) return <p className="muted" style={{ marginBottom: 0 }}>No custom fields on this form yet.</p>
  return (
    <table className="compact">
      <thead>
        <tr><th>Field</th><th>Key</th><th>Type</th><th style={{ width: 90 }}>Required</th><th>Shows</th></tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field.key}>
            <td>{field.label}{field.help && <div className="muted small">{field.help}</div>}</td>
            <td><span className="chip">{field.key}</span></td>
            <td>{CHOICE_TYPES.includes(field.type) ? `${fieldTypeLabel(field.type)}: ${field.options.join(', ')}` : fieldTypeLabel(field.type)}</td>
            <td>{field.required ? 'Yes' : 'No'}</td>
            <td>{describeRule(field, inputs, optionsByInput)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function describeRule(field, inputs, optionsByInput) {
  const row = toRow(field)
  if (!row.ruleInput) return 'Always'
  const input = inputs.find((i) => i.key === row.ruleInput)
  const labels = row.ruleValues.map((value) => (optionsByInput[row.ruleInput] || []).find((o) => o.value === value)?.label || value)
  return `When ${input?.label || row.ruleInput} is ${orList(labels)}`
}

function Unavailable({ code, form }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="small"><Link to="/custom-fields">← Custom fields</Link></div>
          <h1>{form ? form.name : 'Unknown form'}</h1>
        </div>
      </div>
      <div className="panel empty-state">
        <h2>{form ? 'Coming soon' : 'No such form'}</h2>
        <p className="muted">
          {form
            ? `${form.name} records can't keep custom fields yet. Forms get them one at a time.`
            : `There's no form called “${code}”.`}
        </p>
      </div>
    </div>
  )
}
