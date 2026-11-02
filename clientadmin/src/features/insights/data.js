import { useMemo } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { insightsApi } from '@/features/insights/api.js'
import { byStart, covering } from '@/features/management/utils.js'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import { todayIso } from '@/shared/utils/dates.js'

// ---------- Periods ----------
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const RANGES = [
  { key: 'month', label: 'This month', months: 1 },
  { key: 'quarter', label: '3 months', months: 3 },
  { key: 'half', label: '6 months', months: 6 },
  { key: 'year', label: '12 months', months: 12 },
]

// The first day of the window (start of a month) to today.
export function rangeDates(key, now = new Date()) {
  const months = RANGES.find((r) => r.key === key)?.months ?? 1
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const days = Math.max(1, Math.round((now - from) / 86_400_000) + 1)
  return { from: iso(from), to: iso(now), days: Math.min(365, days), weeks: Math.min(26, Math.max(2, Math.ceil(days / 7))) }
}

// ---------- The unit tree: branch → department → team ----------
export const LEVELS = [
  { key: 'branch', label: 'Branch', plural: 'Branches' },
  { key: 'department', label: 'Department', plural: 'Departments' },
  { key: 'team', label: 'Team', plural: 'Teams' },
  { key: 'person', label: 'Person', plural: 'People' },
]

export function unitTree(units = []) {
  const byId = new Map(units.map((u) => [u.id, u]))
  const children = new Map()
  for (const u of units) {
    const key = u.parent_id ?? null
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(u)
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  // The unit of `type` at or above `id` (a team's department, a department's branch).
  const ancestorOfType = (id, type) => {
    let unit = byId.get(id)
    while (unit) {
      if (unit.unit_type === type) return unit.id
      unit = byId.get(unit.parent_id)
    }
    return null
  }
  // `id` and every unit under it.
  const subtree = (id) => {
    const out = new Set()
    const walk = (uid) => {
      out.add(uid)
      for (const child of children.get(uid) ?? []) walk(child.id)
    }
    if (id) walk(id)
    return out
  }
  // `id` itself, then up to the root.
  const path = (id) => {
    const out = []
    let unit = byId.get(id)
    while (unit) {
      out.unshift(unit)
      unit = byId.get(unit.parent_id)
    }
    return out
  }
  return { byId, children, ancestorOfType, subtree, path, name: (id) => byId.get(id)?.name }
}

// Sums `rows` (each with a unit id) into groups: the unit of `level` above each row's unit.
// Rows whose unit has no unit of that level above it land in the `null` group.
export function rollupByLevel(rows, unitIdOf, level, tree, add) {
  const groups = new Map()
  for (const row of rows) {
    const unitId = unitIdOf(row)
    const key = unitId ? tree.ancestorOfType(unitId, level) : null
    if (!groups.has(key)) groups.set(key, add(undefined, undefined))
    groups.set(key, add(groups.get(key), row))
  }
  return groups
}

// Sums `rows` whose unit is in `ids` (a set).
export function sumWithin(rows, unitIdOf, ids, add) {
  let total = add(undefined, undefined)
  for (const row of rows) if (ids.has(unitIdOf(row))) total = add(total, row)
  return total
}

// ---------- Adders: how each kind of row sums ----------
const n = (v) => Number(v ?? 0)
export const add = {
  work: (acc = { todo: 0, in_progress: 0, in_review: 0, blocked: 0, open: 0, overdue: 0, done_recent: 0 }, r) =>
    r ? Object.fromEntries(Object.keys(acc).map((k) => [k, acc[k] + n(r[k])])) : acc,
  projects: (acc = { total: 0, running: 0, completed: 0, progressSum: 0, green: 0, amber: 0, red: 0, late: 0 }, r) =>
    r
      ? {
          total: acc.total + n(r.total),
          running: acc.running + n(r.running),
          completed: acc.completed + n(r.completed),
          progressSum: acc.progressSum + n(r.average_progress_pct) * n(r.running),
          green: acc.green + n(r.green),
          amber: acc.amber + n(r.amber),
          red: acc.red + n(r.red),
          late: acc.late + n(r.late),
        }
      : acc,
  budget: (acc = { planned: 0, approved: 0, actual: 0, count: 0 }, r) =>
    r ? { planned: acc.planned + n(r.planned), approved: acc.approved + n(r.approved), actual: acc.actual + n(r.actual), count: acc.count + 1 } : acc,
  time: (acc = { minutes: 0, billable: 0 }, r) => (r ? { minutes: acc.minutes + n(r.minutes), billable: acc.billable + n(r.billable_minutes) } : acc),
  people: (acc = 0, r) => (r ? acc + n(r.count) : acc),
  kpi: (acc = { sum: 0, count: 0, green: 0, amber: 0, red: 0 }, r) => {
    if (!r || r.achievement_pct === null || r.achievement_pct === undefined) return acc
    const pct = n(r.achievement_pct)
    const rag = kpiRag(pct)
    return { ...acc, sum: acc.sum + pct, count: acc.count + 1, [rag]: acc[rag] + 1 }
  },
}

export const avgProgress = (p) => (p && p.running ? p.progressSum / p.running : null)
export const kpiScore = (k) => (k && k.count ? k.sum / k.count : null)
// The scorecard's own thresholds (management's kpi_engine: green from 90%, amber from 70%).
export const kpiRag = (pct) => (pct >= 90 ? 'green' : pct >= 70 ? 'amber' : 'red')
export const budgetUse = (b) => (b && b.approved > 0 ? (b.actual / b.approved) * 100 : null)

// ---------- Queries: each only when the user may read the list behind it ----------
export function useInsightQueries(orgId, { range = 'month', tasks: taskParams, time: timeParams, need = {} } = {}) {
  const { user } = useAuth()
  const can = (rule) => Boolean(orgId) && hasAccess(user, rule)
  const want = (part) => need[part] !== false
  const { from, to, days, weeks } = rangeDates(range)
  const taskKey = JSON.stringify(taskParams ?? {})
  const timeKey = JSON.stringify(timeParams ?? {})

  const units = useLookup(['org-units', orgId, 'all'], ({ signal }) => insightsApi.units(orgId, { signal }), {
    enabled: can(ACCESS.orgUnits) && want('units'),
  })
  const tasks = useQuery(
    ['insights', orgId, 'tasks', taskKey, days, weeks],
    ({ signal }) => insightsApi.tasks(orgId, { ...taskParams, done_within_days: days, weeks }, { signal }),
    { enabled: can(ACCESS.tasks) && want('tasks'), keepPrevious: true },
  )
  const projects = useQuery(['insights', orgId, 'projects'], ({ signal }) => insightsApi.projects(orgId, { signal }), {
    enabled: can(ACCESS.projects) && want('projects'),
  })
  const time = useQuery(
    ['insights', orgId, 'time', timeKey, from, to],
    ({ signal }) => insightsApi.time(orgId, { date_from: from, date_to: to, ...timeParams }, { signal }),
    { enabled: can(ACCESS.timeSummary) && want('time'), keepPrevious: true },
  )
  const budgets = useQuery(['insights', orgId, 'budgets'], ({ signal }) => insightsApi.budgets(orgId, { signal }), {
    enabled: can(ACCESS.budgets) && want('budgets'),
  })
  const workforce = useQuery(['insights', orgId, 'workforce'], ({ signal }) => insightsApi.workforce(orgId, { signal }), {
    enabled: can(ACCESS.people) && want('workforce'),
  })
  const kpis = useKpiResults(orgId, can(ACCESS.kpiResults) && want('kpis'))

  return { units, tasks, projects, time, budgets, workforce, kpis, range: { from, to, days, weeks } }
}

// KPI results of the period covering today: the year's quarter covering today, else its latest period.
function useKpiResults(orgId, enabled) {
  const years = useLookup(['insights', orgId, 'fiscal-years'], ({ signal }) => insightsApi.fiscalYears(orgId, { signal }).then(byStart), {
    enabled,
  })
  const year = covering(years.data, todayIso())
  const periods = useLookup(
    ['insights', orgId, 'periods', year?.id],
    ({ signal }) => insightsApi.periods(orgId, year.id, { signal }).then(byStart),
    { enabled: enabled && Boolean(year) },
  )
  const period = useMemo(() => {
    const list = periods.data ?? []
    const quarters = list.filter((p) => p.period_type === 'quarter')
    return covering(quarters.length ? quarters : list, todayIso())
  }, [periods.data])
  const results = useQuery(
    ['insights', orgId, 'kpi-results', period?.id],
    ({ signal }) => insightsApi.kpiResults(orgId, period.id, { signal }),
    { enabled: enabled && Boolean(period) },
  )
  return {
    data: results.data ? { period, year, results: results.data } : enabled && years.data && !year ? { period: null, year: null, results: [] } : null,
    loading: years.loading || periods.loading || results.loading,
    error: years.error || periods.error || results.error,
    reload: () => {
      years.reload()
      periods.reload?.()
      results.reload()
    },
  }
}
