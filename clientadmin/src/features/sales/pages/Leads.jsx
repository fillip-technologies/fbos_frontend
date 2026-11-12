import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { leadsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'
import useLeadPeople from '@/features/sales/useLeadPeople.js'
import { LEAD_SOURCES, LEAD_STATUSES, OPEN_LEAD_STATUSES, OUTREACH_LABEL, humanize } from '@/features/sales/utils.js'

const NO_FILTERS = { status: '', source: '' }
// Unclaimed: waiting for someone to take them. Mine: the ones I handle. Follow-ups: calls due today or earlier.
const TABS = [
  ['unclaimed', 'Unclaimed'],
  ['mine', 'Mine'],
  ['follow_ups', 'Follow-ups due'],
  ['all', 'All'],
]

function tabFilters(tab, me) {
  if (tab === 'unclaimed') return { unclaimed: true }
  if (tab === 'mine') return { owner_user_id: me?.id }
  if (tab === 'follow_ups') return { owner_user_id: me?.id, follow_up_due: todayIso() }
  return {}
}

export default function Leads() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { personName } = useLeadPeople(orgId)
  const canWork = hasAccess(me, ACCESS.manageLeads)

  // Home's "Needs you" links straight to a tab (?tab=unclaimed, ?tab=follow_ups).
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => (TABS.some(([key]) => key === searchParams.get('tab')) ? searchParams.get('tab') : 'all'))
  const [filters, setFilters] = useState(NO_FILTERS)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [claiming, setClaiming] = useState(null)
  const [claimError, setClaimError] = useState(null)

  const params = { ...filters, ...tabFilters(tab, me) }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['leads', orgId, { cursor, params }],
    ({ signal }) => leadsApi.list(orgId, { limit: 25, cursor, ...params }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const leads = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null
  const today = todayIso()

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (k, v) => {
    resetPaging()
    setFilters((f) => ({ ...f, [k]: v }))
  }

  async function claim(e, lead) {
    e.stopPropagation()
    setClaimError(null)
    setClaiming(lead.id)
    try {
      await leadsApi.claim(orgId, lead.id)
      invalidate(['leads', orgId])
      invalidate(['lead', orgId])
    } catch (err) {
      setClaimError(err)
      invalidate(['leads', orgId])
    } finally {
      setClaiming(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Enquiries for {activeOrg ? `“${activeOrg.name}”` : 'this company'}. Claim one, log your calls, then qualify
            the good ones into a customer and an opportunity.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {canWork && <Link className="btn" to="/leads/new">+ New lead</Link>}
        </div>
      </div>

      <div className="version-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => {
              resetPaging()
              setTab(key)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
          <option value="">Any source</option>
          {Object.entries(LEAD_SOURCES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={claimError || error} onRetry={claimError ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Company</th>
              <th>Source</th>
              <th>{OUTREACH_LABEL}</th>
              <th>Status</th>
              <th>Next follow-up</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="center-note">
                  {tab === 'unclaimed' ? 'No leads are waiting to be claimed.' : tab === 'follow_ups' ? 'No follow-ups due.' : 'No leads found.'}
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const open = OPEN_LEAD_STATUSES.includes(l.status)
                const overdue = open && l.next_follow_up_on && l.next_follow_up_on <= today
                return (
                  <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.contact_name}</div>
                      <div className="muted small">
                        <span className="mono">{l.code}</span>
                        {(l.contact_email || l.contact_phone) && ` · ${l.contact_email || l.contact_phone}`}
                      </div>
                    </td>
                    <td>{l.company_name || <span className="muted">—</span>}</td>
                    <td>{LEAD_SOURCES[l.source] || l.source || '—'}</td>
                    <td>
                      {l.owner ? (
                        personName(l.owner.id) || <span className="muted">Someone</span>
                      ) : open && canWork ? (
                        <button
                          type="button"
                          className="btn secondary small-btn"
                          disabled={claiming === l.id}
                          aria-busy={claiming === l.id}
                          onClick={(e) => claim(e, l)}
                        >
                          Claim
                        </button>
                      ) : (
                        <span className="muted">Unclaimed</span>
                      )}
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className={`small ${overdue ? 'overdue' : 'muted'}`}>
                      {open && l.next_follow_up_on ? formatDate(l.next_follow_up_on) : '—'}
                    </td>
                    <td className="muted small">{formatDate(l.created_at.slice(0, 10))}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
