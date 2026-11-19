import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { attentionApi, overviewApi } from '@/features/dashboard/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import { todayIso } from '@/shared/utils/dates.js'

// The overview's default period; its invoice summary is shared with this card (same key).
const OVERVIEW_MONTHS = 6

function money(m) {
  const n = Number(m?.amount)
  if (!Number.isFinite(n) || n <= 0) return null
  try {
    return n.toLocaleString(undefined, { style: 'currency', currency: m.currency, maximumFractionDigits: 0 })
  } catch {
    return `${n.toFixed(0)} ${m.currency}`
  }
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Item({ item }) {
  return (
    <li className={`needs-item${item.tone ? ` is-${item.tone}` : ''}`}>
      <Link to={item.to}>
        <span className="needs-figure">{item.figure}</span>
        <span className="needs-text">
          <strong>{item.title}</strong>
          <small>{item.hint}</small>
        </span>
        <span className="needs-go" aria-hidden="true">→</span>
      </Link>
    </li>
  )
}

/**
 * "Needs you": the things waiting on the signed-in person, most urgent first, each a link to where
 * it is dealt with. Each source is asked for only when the person may see it; a source that
 * fails is left out rather than shown as zero.
 */
export default function NeedsYou() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const may = (rule) => Boolean(orgId) && hasAccess(user, rule)

  const tasks = useQuery(['attention', orgId, 'tasks'], (o) => attentionApi.myTasks(orgId, o), { enabled: may(ACCESS.tasks) })
  const quotes = useQuery(['attention', orgId, 'quotations'], (o) => attentionApi.quotationsToApprove(orgId, o), {
    enabled: may(ACCESS.approveQuotations) && may(ACCESS.opportunities),
  })
  const billing = useQuery(['attention', orgId, 'ready-to-bill'], (o) => attentionApi.readyToBill(orgId, o), {
    enabled: may(ACCESS.billingSchedules),
  })
  const invoices = useQuery(['overview', orgId, 'invoices', OVERVIEW_MONTHS], (o) => overviewApi.invoices(orgId, OVERVIEW_MONTHS, o), {
    enabled: may(ACCESS.invoices),
  })
  const roles = useQuery(['attention', orgId, 'role-changes'], (o) => attentionApi.roleChanges(orgId, o), {
    enabled: may(ACCESS.approveRoleChanges),
  })
  const leave = useQuery(['attention', orgId, 'leave'], (o) => attentionApi.pendingLeave(orgId, o), {
    enabled: may(ACCESS.approveLeaves),
  })
  const today = todayIso()
  const unclaimed = useQuery(['attention', orgId, 'unclaimed-leads'], (o) => attentionApi.unclaimedLeads(orgId, o), {
    enabled: may(ACCESS.manageLeads),
  })
  const followUps = useQuery(['attention', orgId, 'lead-follow-ups', today], (o) => attentionApi.leadFollowUps(orgId, user?.id, today, o), {
    enabled: may(ACCESS.manageLeads) && Boolean(user?.id),
  })
  const count = (page) => (page?.data?.length ?? 0)
  const countLabel = (page) => `${count(page)}${page?.page?.has_more ? '+' : ''}`

  const items = []
  const t = tasks.data
  if (t?.overdue > 0) {
    items.push({ key: 'overdue', tone: 'late', figure: t.overdue, title: `${plural(t.overdue, 'task')} past due`, hint: 'Yours, and late. Start with these.', to: '/tasks' })
  }
  if (t?.due_today > 0) {
    items.push({ key: 'today', figure: t.due_today, title: `${plural(t.due_today, 'task')} due today`, hint: 'Assigned to you', to: '/tasks' })
  }
  const quoteList = quotes.data?.data ?? []
  if (quoteList.length) {
    const first = quoteList[0]
    items.push({
      key: 'quotes',
      figure: quoteList.length + (quotes.data.page?.has_more ? '+' : ''),
      title: `${quoteList.length === 1 ? 'Quotation' : 'Quotations'} to approve`,
      hint: quoteList.length === 1 ? `${first.quote_no} · ${first.client.name}` : 'Sales is waiting on your decision',
      to: quoteList.length === 1 ? `/quotations/${first.id}` : `/opportunities`,
    })
  }
  if (count(followUps.data) > 0) {
    const n = count(followUps.data)
    items.push({ key: 'follow-ups', tone: 'late', figure: countLabel(followUps.data), title: `${plural(n, 'lead follow-up')} due`, hint: 'Calls you planned for today or earlier', to: '/leads?tab=follow_ups' })
  }
  if (count(unclaimed.data) > 0) {
    const n = count(unclaimed.data)
    items.push({ key: 'unclaimed', figure: countLabel(unclaimed.data), title: `${plural(n, 'lead')} waiting to be claimed`, hint: 'New enquiries nobody is handling yet', to: '/leads?tab=unclaimed' })
  }
  const due = Array.isArray(billing.data) ? billing.data.length : 0
  if (due > 0) {
    items.push({ key: 'bill', figure: due, title: `${plural(due, 'payment term')} ready to bill`, hint: 'Contract payments that have fallen due', to: '/billing-schedules' })
  }
  const overdue = money(invoices.data?.overdue)
  if (overdue) {
    items.push({ key: 'collect', tone: 'late', figure: overdue, title: 'Overdue from customers', hint: 'Follow up with the customers who owe it', to: '/collections' })
  }
  const roleList = roles.data?.data ?? []
  if (roleList.length) {
    items.push({ key: 'roles', figure: roleList.length, title: `${plural(roleList.length, 'role change')} waiting`, hint: 'Promotions and transfers to approve', to: '/people/role-changes' })
  }
  const leaveList = Array.isArray(leave.data) ? leave.data : []
  if (leaveList.length) {
    items.push({ key: 'leave', figure: leaveList.length, title: `${plural(leaveList.length, 'leave request')} pending`, hint: 'Waiting for a decision', to: '/people/leaves' })
  }

  const sources = [tasks, quotes, billing, invoices, roles, leave, unclaimed, followUps]
  const asked = [may(ACCESS.tasks), may(ACCESS.approveQuotations) && may(ACCESS.opportunities), may(ACCESS.billingSchedules), may(ACCESS.invoices), may(ACCESS.approveRoleChanges), may(ACCESS.approveLeaves), may(ACCESS.manageLeads), may(ACCESS.manageLeads)]
  const anyAsked = asked.some(Boolean)
  const stillLoading = sources.some((q, i) => asked[i] && q.loading)
  if (!anyAsked) return null

  return (
    <section className="home-section needs-you" aria-busy={stillLoading}>
      <div className="home-section-head">
        <h2>Needs you</h2>
        <span>{stillLoading ? 'Checking…' : items.length ? 'Most urgent first' : 'Nothing waiting'}</span>
      </div>
      {items.length > 0 ? (
        <ul className="needs-list">
          {items.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </ul>
      ) : (
        !stillLoading && (
          <div className="panel needs-clear">
            <strong>You’re all caught up.</strong> Nothing is late or waiting for your decision.
          </div>
        )
      )}
    </section>
  )
}
