import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TypeIcon from '@/features/org-units/components/TypeIcon.jsx'
import VerticalChips from '@/features/org-units/components/VerticalChips.jsx'
import { breadcrumb, childTypesFor, UNIT_TYPE_LABELS } from '@/features/org-units/utils.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const initial = (name) => (name?.trim()?.[0] ?? '?').toUpperCase()

// A person under a unit: a smaller box that opens their page. `kind` is head, member (an extra
// team member who works elsewhere) or works-here.
function PersonNode({ person, unit, kind, term }) {
  const navigate = useNavigate()
  const matches = term && person.name.toLowerCase().includes(term)
  const note = kind === 'head' ? 'Head' : kind === 'member' ? `Member · works in ${person.home_unit?.name ?? 'another unit'}` : 'Works here'
  return (
    <li>
      <div className="hz-row">
        <button type="button" className={`hz-person-node ou-${unit.unit_type}${matches ? ' is-match' : ''}`} onClick={() => navigate(`/users/${person.id}`)}
          title={`${person.name}: open their page`}>
          <span className="hz-pavatar">{initial(person.name)}</span>
          <span className="hz-text">
            <strong>{person.name}</strong>
            <small>{note}</small>
          </span>
        </button>
      </div>
    </li>
  )
}

// One unit as a small box, with the people and units under it to its right. `ctx` carries what
// every box shares.
function Node({ unit, ctx }) {
  const { children, peopleByUnit, folded, term, selectedId, select, toggle } = ctx
  const kids = children.get(unit.id) ?? []
  const people = peopleByUnit.get(unit.id) ?? []
  const total = kids.length + people.length
  // A search opens everything on the way to a match.
  const open = term ? true : !folded.has(unit.id)
  const matches = term && (unit.name.toLowerCase().includes(term) || unit.code.toLowerCase().includes(term))
  return (
    <li>
      <div className="hz-row">
        <button
          type="button"
          className={`hz-node ou-${unit.unit_type}${selectedId === unit.id ? ' is-selected' : ''}${unit.status === 'active' ? '' : ' is-inactive'}${matches ? ' is-match' : ''}`}
          aria-pressed={selectedId === unit.id}
          onClick={() => select(unit.id)}
        >
          <span className="hz-icon"><TypeIcon type={unit.unit_type} /></span>
          <span className="hz-text">
            <strong>{unit.name}</strong>
            <small>
              {UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}
              {unit.head_user ? ` · ${unit.head_user.name}` : ''}
            </small>
          </span>
        </button>
        {total > 0 && (
          <button type="button" className={`hz-fold ou-${unit.unit_type}`} aria-expanded={open} onClick={() => toggle(unit.id)}
            aria-label={`${open ? 'Fold' : 'Open'} ${unit.name}`} title={open ? 'Fold' : `Show ${total} under`}>
            {open ? '‹' : total}
          </button>
        )}
      </div>
      {total > 0 && open && (
        <ul>
          {people.map((p) => <PersonNode key={`${p.person.id}-${p.kind}`} person={p.person} unit={unit} kind={p.kind} term={term} />)}
          {kids.map((k) => <Node key={k.id} unit={k} ctx={ctx} />)}
        </ul>
      )}
    </li>
  )
}

// What is known about the unit picked on the chart, and what can be done with it.
function Details({ unit, unitsById, verticalNames, canCreate, navigate, onClose }) {
  const above = breadcrumb(unit, unitsById)
  const add = canCreate && unit.status === 'active' ? childTypesFor(unit.unit_type) : []
  return (
    <aside className={`hz-panel has-unit ou-${unit.unit_type}`}>
      <button type="button" className="hz-close" onClick={onClose} aria-label="Close details">×</button>
      <div className="hz-panel-head">
        <span className="hz-icon big"><TypeIcon type={unit.unit_type} size={22} /></span>
        <div>
          <h3>{unit.name}</h3>
          <span className="ou-pill">{UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}</span>
          {unit.status !== 'active' && <StatusBadge status={unit.status} />}
        </div>
      </div>
      <dl className="hz-facts">
        <div><dt>Code</dt><dd className="mono">{unit.code}</dd></div>
        <div>
          <dt>Head</dt>
          <dd>
            {unit.head_user ? (
              <span className="hz-person"><span className="hz-avatar">{initial(unit.head_user.name)}</span>{unit.head_user.name}</span>
            ) : (
              <span className="muted">No head yet</span>
            )}
          </dd>
        </div>
        {above.length > 0 && <div><dt>Sits under</dt><dd>{above.map((a) => a.name).join(' › ')}</dd></div>}
        <div><dt>Verticals</dt><dd><VerticalChips unit={unit} unitsById={unitsById} names={verticalNames} /></dd></div>
      </dl>
      <div className="hz-actions">
        <button type="button" className="btn" onClick={() => navigate(`/org-units/${unit.id}`)}>Open page</button>
        {add.length > 0 && (
          <button type="button" className="btn secondary" onClick={() => navigate(`/org-units/new?parent=${unit.id}`)}>
            + Add {add.map((t) => UNIT_TYPE_LABELS[t].toLowerCase()).join(' / ')}
          </button>
        )}
      </div>
    </aside>
  )
}

// The structure as a tree that grows to the right: the company at the left, then branches,
// departments and teams, each joined to the one before it, with the people who work in each.
// A box picks a unit; its details open at the side. On a phone the tree grows downwards instead.
export default function UnitTree({ units, unitsById, verticalNames, canCreate, term, loading, companyName, people = [], showPeople = true }) {
  const navigate = useNavigate()
  const [folded, setFolded] = useState(() => new Set())
  const [selectedId, setSelectedId] = useState(null)
  const boxRef = useRef(null)
  const innerRef = useRef(null)
  // Scale of the chart so all of it fits the width of the page (never below 55%; phones use the
  // downward tree instead and need none).
  const [fit, setFit] = useState(1)

  // Who is drawn under which unit: where they work, and the teams they are extra members of.
  const peopleByUnit = useMemo(() => {
    const out = new Map()
    if (!showPeople) return out
    const add = (unitId, entry) => {
      if (!unitsById[unitId]) return
      if (!out.has(unitId)) out.set(unitId, [])
      out.get(unitId).push(entry)
    }
    for (const person of people) {
      if (person.status && person.status !== 'active') continue
      const home = person.home_unit?.id
      if (home) {
        const isHead = unitsById[home]?.head_user?.id === person.id
        add(home, { person, kind: isHead ? 'head' : 'here' })
      }
      for (const team of person.teams ?? []) if (team.id !== home) add(team.id, { person, kind: 'member' })
    }
    for (const list of out.values()) list.sort((a, b) => (a.kind === 'head' ? -1 : b.kind === 'head' ? 1 : a.person.name.localeCompare(b.person.name)))
    return out
  }, [people, showPeople, unitsById])

  // The units to draw: all, or (while searching) the matches with the units above them.
  const shown = useMemo(() => {
    if (!term) return units
    const keep = new Set()
    const keepPath = (u) => u.path.split('/').filter(Boolean).forEach((id) => keep.add(id))
    for (const u of units) if (u.name.toLowerCase().includes(term) || u.code.toLowerCase().includes(term)) keepPath(u)
    for (const [unitId, entries] of peopleByUnit) {
      if (entries.some((e) => e.person.name.toLowerCase().includes(term)) && unitsById[unitId]) keepPath(unitsById[unitId])
    }
    return units.filter((u) => keep.has(u.id))
  }, [units, term, peopleByUnit, unitsById])

  const { roots, children } = useMemo(() => {
    const ids = new Set(shown.map((u) => u.id))
    const kids = new Map()
    for (const u of shown) {
      const key = u.parent_id && ids.has(u.parent_id) ? u.parent_id : null
      if (!kids.has(key)) kids.set(key, [])
      kids.get(key).push(u)
    }
    for (const list of kids.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return { roots: kids.get(null) ?? [], children: kids }
  }, [shown])

  const toggle = (id) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const withKids = useMemo(() => {
    const ids = new Set([...children.keys(), ...peopleByUnit.keys()])
    ids.delete(null)
    return [...ids]
  }, [children, peopleByUnit])
  const selected = selectedId ? unitsById[selectedId] : null

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return undefined
    const measure = () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        setFit(1)
        return
      }
      // Measured at full size, then put back.
      const was = inner.style.zoom
      inner.style.zoom = '1'
      const natural = inner.scrollWidth
      inner.style.zoom = was
      const available = box.clientWidth - 36
      const next = natural > 0 ? Math.max(0.55, Math.min(1, available / natural)) : 1
      setFit((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [roots, folded, term, loading, shown, peopleByUnit])

  if (loading) return <div className="panel"><p className="muted">Loading the structure…</p></div>
  if (shown.length === 0) return <div className="panel"><p className="center-note">Nothing matches.</p></div>

  const ctx = { children, peopleByUnit, folded, term, selectedId, select: (id) => setSelectedId((cur) => (cur === id ? null : id)), toggle }
  return (
    <div className="hz-wrap">
      <div className="hz-layout">
        <div className="hz-scroll panel" ref={boxRef}>
          <div className="hz-tools">
            <button type="button" className="btn secondary small-btn" onClick={() => setFolded(new Set())}>Open all</button>
            <button type="button" className="btn secondary small-btn" onClick={() => setFolded(new Set(withKids))}>Fold all</button>
          </div>
          <div className="hz" ref={innerRef} style={{ zoom: fit }}>
            <ul>
              <li>
                <div className="hz-row">
                  <div className="hz-node hz-company ou-company">
                    <span className="hz-icon"><TypeIcon type="company" /></span>
                    <span className="hz-text"><strong>{companyName || 'The company'}</strong><small>Company</small></span>
                  </div>
                </div>
                <ul>
                  {roots.map((u) => <Node key={u.id} unit={u} ctx={ctx} />)}
                </ul>
              </li>
            </ul>
          </div>
        </div>
        {selected && (
          <Details unit={selected} unitsById={unitsById} verticalNames={verticalNames} canCreate={canCreate} navigate={navigate}
            onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  )
}
