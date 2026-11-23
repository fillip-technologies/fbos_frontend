import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { boardsApi } from '@/features/delivery/api.js'
import { anchorsWithin, placeMoved, projectColumnNamed } from '@/features/delivery/board.js'
import ModuleColumns from '@/features/delivery/components/ModuleColumns.jsx'
import ModuleDialog from '@/features/delivery/components/ModuleDialog.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// One customer's projects on one board: every project board's modules, in columns matched by
// name. A module moves only to a column its own project's board has (the customer page links here).
export default function CustomerBoard() {
  const { clientId } = useParams()
  const { orgId } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const known = names.customerName({ id: clientId })
  const name = known && known !== '—' ? known : null
  const [moved, setMoved] = useState({})
  const [opened, setOpened] = useState(null)
  const [actionError, setActionError] = useState(null)

  const { data, error, loading, refreshing, reload } = useQuery(
    ['customer-board', orgId, clientId],
    ({ signal }) => boardsApi.customer(orgId, clientId, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  useEffect(() => setMoved({}), [data])

  const projects = new Map((data?.projects ?? []).map((p) => [p.work_unit_id, p]))
  const projectOf = (module) => projects.get(module.work_unit_id)
  const keyOf = (c) => c.key
  const columns = placeMoved(
    (data?.columns ?? []).map((c) => ({
      ...c,
      key: c.name.trim().toLowerCase(),
      modules: c.modules.map((m) => ({ ...m, projectName: projectOf(m)?.name })),
    })),
    moved,
    keyOf
  )
  const refresh = () => {
    invalidate(['customer-board', orgId, clientId])
    invalidate(['board', orgId])
  }

  const targetFor = (module, column) => {
    const project = projectOf(module)
    return project?.can_edit ? projectColumnNamed(project, column.name) : null
  }

  async function moveTo(module, column, index) {
    const target = targetFor(module, column)
    if (!target) return
    setActionError(null)
    const anchors = anchorsWithin(column.modules, module.id, index, (m) => m.work_unit_id === module.work_unit_id)
    setMoved((m) => ({ ...m, [module.id]: { columnKey: column.key, anchors } }))
    try {
      await boardsApi.placeModule(orgId, module.board_id, module.id, { column_id: target.id, ...anchors })
      refresh()
    } catch (err) {
      setMoved(({ [module.id]: _, ...rest }) => rest)
      setActionError(err)
    }
  }

  function menuFor(module, column) {
    return columns
      .filter((other) => other.key !== column.key && targetFor(module, other))
      .map((other) => ({ label: `Move to ${other.name}`, run: () => moveTo(module, other, other.modules.length) }))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{name ? `${name}: board` : 'Customer board'}</h1>
          <p className="muted">
            The modules of all this customer's projects, by column. <Link to={`/customers/${clientId}`}>Back to the customer</Link>
          </p>
        </div>
      </div>
      {!opened && <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />}
      {loading || !data ? (
        !error && <PanelSkeleton />
      ) : data.columns.length === 0 ? (
        <div className="panel center-note">
          None of this customer's projects has a board yet. Open a project and its Board tab to start one.
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            Projects: {data.projects.map((p, i) => (
              <span key={p.work_unit_id}>
                {i > 0 && ', '}
                <Link to={`/projects/${p.work_unit_id}?tab=board`}>{p.name}</Link>
              </span>
            ))}. Drag a module to another column its project's board has.
          </p>
          <div className={refreshing ? 'is-refreshing' : undefined}>
            <ModuleColumns
              columns={columns}
              names={names}
              canDrag={(module) => Boolean(projectOf(module)?.can_edit)}
              canDropOn={(module, column) => Boolean(targetFor(module, column))}
              onDrop={moveTo}
              onOpen={(module) => setOpened(module)}
              menuFor={menuFor}
            />
          </div>
        </>
      )}
      {opened && (
        <ModuleDialog
          orgId={orgId}
          boardId={opened.board_id}
          workUnitId={opened.work_unit_id}
          module={opened}
          canEdit={Boolean(projectOf(opened)?.can_edit)}
          names={names}
          onClose={() => {
            setOpened(null)
            refresh()
          }}
          onSaved={() => {
            setOpened(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
