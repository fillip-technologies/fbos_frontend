import { useState } from 'react'
import { taxConfigApi } from '@/features/tax/api.js'
import { CONFIG_KINDS, entrySummary, errorMeta, isInEffect } from '@/features/tax/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

// What a new entry of each kind looks like; the backend checks every field.
const EXAMPLES = {
  rate: { percent: 18, notification: 'Notification reference' },
  category: { regime: 'IN-GST', name: 'Services — 18%', treatment: 'taxable', supply_kind: 'service', rate: 'GST_18', classification: '9983' },
  rule: { regime: 'IN-GST', priority: 40, when: { supply_type: ['inter_state'] }, then: [{ component: 'IGST', rate_from_category: true }], note: null },
  component: { regime: 'IN-GST', label: 'Cess', behaviour: 'added', base: 'taxable_value', sequence: 20 },
  jurisdiction: { regime: 'IN-GST', name: 'State name', kind: 'state' },
  withholding_section: { regime: 'IN-ITD', nature: 'Fees for professional services', statute_ref: 's.393(1)', aliases: [], rates: { default: 10 }, payment_codes: {}, no_pan_percent: 20, thresholds: [] },
  deadline: { regime: 'IN-GST', description: 'What must happen by when', applies_to: ['credit_note'], rule: { type: 'after_fy_end', month: 11, day: 30 }, severity: 'block' },
  series_template: { prefix: 'INV', format: '{prefix}/{fy_short}/{seq:06d}', reset: 'fiscal_year' },
  regime: { name: 'Tax system', country: 'IN', kind: 'indirect' },
}

const pretty = (data) => JSON.stringify(data, null, 2)

// The specific problems behind a refused change: broken references, or invalid fields.
function ProblemList({ error }) {
  const meta = errorMeta(error)
  const problems = [
    ...(meta?.problems || []),
    ...(meta?.errors || []).map((item) => `${(item.loc || []).join('.')}: ${item.msg}`),
    ...(meta?.entries || []).map((item) => `${item.kind} ${item.code}`),
  ]
  if (!problems.length) return null
  return (
    <ul className="small field-error">
      {problems.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function parseData(text) {
  try {
    return { data: JSON.parse(text) }
  } catch {
    return { problem: 'That isn’t valid JSON.' }
  }
}

// Add an entry, or replace one from a date (the old one closes that day, in the same change).
function EntryForm({ orgId, kind, replacing, onDone, onCancel }) {
  const [form, setForm] = useState({
    code: replacing?.code || '',
    effective_from: todayIso(),
    effective_to: '',
    data: pretty(replacing?.data || EXAMPLES[kind] || {}),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [problem, setProblem] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const parsed = parseData(form.data)
    setProblem(parsed.problem || null)
    if (parsed.problem) return
    setSaving(true)
    setError(null)
    try {
      const body = { kind, code: form.code.trim(), effective_from: form.effective_from, data: parsed.data }
      if (form.effective_to) body.effective_to = form.effective_to
      if (replacing) body.supersedes_id = replacing.id
      await taxConfigApi.create(orgId, body)
      onDone()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={submit} style={{ marginTop: 0, marginBottom: 14 }}>
      <h3>{replacing ? `Replace ${replacing.code} from a date` : `New ${CONFIG_KINDS[kind]?.toLowerCase() || kind} entry`}</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        {replacing
          ? 'The current entry stays as it is for everything before this date, so documents already issued keep their tax.'
          : 'Entries apply from their start date. Use a code that doesn’t exist yet, or replace the existing entry instead.'}
      </p>
      {(problem || error) && <ErrorBanner error={error || new Error(problem)} />}
      <ProblemList error={error} />
      <div className="grid-3">
        <div className="field">
          <label htmlFor="entry-code">Code *</label>
          <input id="entry-code" required className="mono-input" maxLength={100} disabled={Boolean(replacing)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="entry-from">In effect from *</label>
          <input id="entry-from" type="date" required value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
          <div className="hint">For a change of law, the notification’s date.</div>
        </div>
        <div className="field">
          <label htmlFor="entry-to">Until (not including)</label>
          <input id="entry-to" type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="entry-data">Details</label>
        <textarea id="entry-data" className="mono-input" rows={10} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : replacing ? 'Replace from this date' : 'Add entry'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

function CloseForm({ orgId, entry, onDone, onCancel }) {
  const [day, setDay] = useState(entry.effective_to || todayIso())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await taxConfigApi.update(orgId, entry, { effective_to: day })
      onDone()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 6 }}>
      <ErrorBanner error={error} />
      <ProblemList error={error} />
      <div className="row-actions" style={{ alignItems: 'end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={`close-${entry.id}`}>No longer in effect from</label>
          <input id={`close-${entry.id}`} type="date" min={todayIso()} required value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <button className="btn small-btn" type="submit" disabled={saving}>Close it</button>
        <button type="button" className="btn secondary small-btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

// The organization's tax configuration, one kind at a time. Nothing is edited in place once
// it is in effect: it is closed, or replaced from a date, so issued documents never change.
export default function TaxConfigEntries({ orgId, canManage }) {
  const [kind, setKind] = useState('rate')
  const [asOf, setAsOf] = useState(todayIso())
  const [allDates, setAllDates] = useState(false)
  const params = { kind, as_of: allDates ? undefined : asOf }
  const { data, error, loading, reload } = useQuery(['tax-config', orgId, params], ({ signal }) => taxConfigApi.entries(orgId, params, { signal }), {
    enabled: Boolean(orgId),
    keepPrevious: true,
  })
  const entries = data ?? []
  // null | { mode: 'add' } | { mode: 'replace', entry } | { mode: 'close', entry }
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)
  const today = todayIso()

  const done = () => {
    setEditing(null)
    invalidate(['tax-config', orgId])
    invalidate(['tax-entries', orgId])
    invalidate(['tax-revisions', orgId])
    reload()
  }

  async function remove(entry) {
    if (!window.confirm(`Delete ${entry.code} from ${entry.effective_from}? It hasn’t started yet.`)) return
    setActionError(null)
    try {
      await taxConfigApi.remove(orgId, entry)
      done()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: 17 }}>Rates, rules and other tax settings</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Each entry has the dates it is in effect. A change of law is a new entry from its date; documents use what was in effect on
            their tax date.
          </p>
        </div>
        {canManage && !editing && <button className="btn" onClick={() => setEditing({ mode: 'add' })}>+ New entry</button>}
      </div>
      <div className="row-actions" style={{ alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="cfg-kind">Show</label>
          <select id="cfg-kind" value={kind} onChange={(e) => { setKind(e.target.value); setEditing(null) }}>
            {Object.entries(CONFIG_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="cfg-asof">In effect on</label>
          <input id="cfg-asof" type="date" disabled={allDates} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
        </div>
        <label className="inline-check">
          <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} />
          Every date (past and future)
        </label>
      </div>

      <ErrorBanner error={error || actionError} onRetry={error ? reload : undefined} />
      {editing?.mode === 'add' && <EntryForm orgId={orgId} kind={kind} onDone={done} onCancel={() => setEditing(null)} />}
      {editing?.mode === 'replace' && <EntryForm orgId={orgId} kind={kind} replacing={editing.entry} onDone={done} onCancel={() => setEditing(null)} />}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Details</th>
              <th>In effect</th>
              <th>Source</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canManage ? 5 : 4} rows={5} />
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="center-note">Nothing of this kind{allDates ? '' : ' in effect that day'}.</td></tr>
            ) : (
              entries.map((entry) => {
                const started = entry.effective_from <= today
                return (
                  <tr key={entry.id} style={{ cursor: 'default' }}>
                    <td className="mono">{entry.code}</td>
                    <td className="small" style={{ maxWidth: 520 }}>
                      {entrySummary(kind, entry.data)}
                      {editing?.mode === 'close' && editing.entry.id === entry.id && (
                        <CloseForm orgId={orgId} entry={entry} onDone={done} onCancel={() => setEditing(null)} />
                      )}
                    </td>
                    <td className="small">
                      {formatDate(entry.effective_from)} → {entry.effective_to ? formatDate(entry.effective_to) : 'open'}
                      {!isInEffect(entry, today) && <div className="muted">{started ? 'Ended' : 'Not started'}</div>}
                    </td>
                    <td className="small">
                      {entry.origin === 'manual' ? 'Added here' : `Pack ${entry.origin.replace('pack:', '')}`}
                      {entry.locally_modified && <div className="muted">Edited here</div>}
                    </td>
                    {canManage && (
                      <td>
                        {!editing && (
                          <div className="row-actions">
                            <button className="btn secondary small-btn" onClick={() => setEditing({ mode: 'replace', entry })}>Replace from…</button>
                            {(!entry.effective_to || entry.effective_to > today) && (
                              <button className="btn secondary small-btn" onClick={() => setEditing({ mode: 'close', entry })}>Close…</button>
                            )}
                            {!started && <button className="btn danger-outline small-btn" onClick={() => remove(entry)}>Delete</button>}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
