import { DISCIPLINE_ORDER, disciplineLabel } from '@/features/delivery/taskFields.js'
import { TASK_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

export const NO_TASK_FILTERS = { q: '', assignee: '', owning_unit_id: '', priority: '', discipline: '', task_type: '' }

// The filters the task list, board and queue share. `hide` drops ones a view fixes itself.
export default function TaskFilterBar({ filters, setFilter, names, taskTypes, hide = [], children }) {
  const { user: me } = useAuth()
  const shown = (key) => !hide.includes(key)
  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...taskTypes.map((t) => t.discipline)])].filter((d) =>
    taskTypes.some((t) => t.discipline === d)
  )
  const typesInDiscipline = taskTypes.filter((t) => !filters.discipline || t.discipline === filters.discipline)
  return (
    <div className="toolbar">
      {shown('q') && (
        <input type="search" placeholder="Search title or code" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
      )}
      {shown('discipline') && disciplines.length > 1 && (
        <select aria-label="Kind of work" value={filters.discipline} onChange={(e) => { setFilter('discipline', e.target.value); setFilter('task_type', '') }}>
          <option value="">All kinds of work</option>
          {disciplines.map((d) => <option key={d} value={d}>{disciplineLabel(d)}</option>)}
        </select>
      )}
      {shown('task_type') && (
        <select aria-label="Task type" value={filters.task_type} onChange={(e) => setFilter('task_type', e.target.value)}>
          <option value="">Any type</option>
          {typesInDiscipline.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      )}
      {shown('priority') && (
        <select aria-label="Priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">Any priority</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      )}
      {shown('assignee') && names.people && (
        <select aria-label="Assignee" value={filters.assignee} onChange={(e) => setFilter('assignee', e.target.value)}>
          <option value="">Anyone</option>
          <option value="me">Me</option>
          {names.people.filter((u) => u.id !== me?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {shown('owning_unit_id') && names.units && (
        <select aria-label="Team" value={filters.owning_unit_id} onChange={(e) => setFilter('owning_unit_id', e.target.value)}>
          <option value="">Any team</option>
          {names.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {children}
    </div>
  )
}
