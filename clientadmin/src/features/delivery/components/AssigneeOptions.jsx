// The <option>s of an assignee picker: the team's people first, then everyone else when the
// company lets tasks go outside the team. `people` comes from useAssignablePeople; while it is
// null (no team chosen, or not allowed to list people) only the signed-in user is offered.
export default function AssigneeOptions({ people, me }) {
  const label = (u) => (u.id === me?.id ? `${u.name} (you)` : u.name)
  const option = (u) => <option key={u.id} value={u.id}>{label(u)}</option>
  if (!people) return me ? option(me) : null

  const team = people.filter((u) => u.in_unit)
  const others = people.filter((u) => !u.in_unit)
  if (!team.length || !others.length) return people.map(option)
  return (
    <>
      <optgroup label="In this team">{team.map(option)}</optgroup>
      <optgroup label="Everyone else">{others.map(option)}</optgroup>
    </>
  )
}
