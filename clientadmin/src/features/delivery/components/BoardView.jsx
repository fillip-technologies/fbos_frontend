import { useEffect, useState } from 'react'
import { boardsApi } from '@/features/delivery/api.js'
import { anchorsFor, placeMoved } from '@/features/delivery/board.js'
import Dialog from '@/features/delivery/components/Dialog.jsx'
import ModuleColumns from '@/features/delivery/components/ModuleColumns.jsx'
import ModuleDialog from '@/features/delivery/components/ModuleDialog.jsx'
import { friendlyMessage } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// A project's board (like GitHub Projects): the project's work divided into modules, in columns
// the team names. Modules are dragged to a place in any column or moved with their "Move…" menu;
// that never changes a task. Tasks can be linked to a module from its dialog.
export default function BoardView({ orgId, workUnitId, names }) {
  const [moved, setMoved] = useState({}) // module id -> { columnKey, anchors }
  const [opened, setOpened] = useState(null) // { module } or { columnId } for a new one
  const [editing, setEditing] = useState(null) // a column, or {} for a new one
  const [adding, setAdding] = useState(null) // column id with "+ Add item" open
  const [actionError, setActionError] = useState(null)

  const boards = useQuery(['boards', orgId, workUnitId], ({ signal }) => boardsApi.list(orgId, workUnitId, { signal }), {
    enabled: Boolean(orgId && workUnitId),
  })
  const boardId = boards.data?.[0]?.id
  const { data: board, error, loading, refreshing, reload } = useQuery(
    ['board', orgId, boardId],
    ({ signal }) => boardsApi.get(orgId, boardId, { signal }),
    { enabled: Boolean(orgId && boardId), keepPrevious: true }
  )
  // Fresh columns replace the moves shown ahead of them.
  useEffect(() => setMoved({}), [board])
  const refresh = () => {
    invalidate(['board', orgId, boardId])
    invalidate(['customer-board', orgId])
  }

  if (boards.error) return <ErrorBanner error={boards.error} onRetry={boards.reload} />
  if (boards.loading || loading || !board) return error ? <ErrorBanner error={error} onRetry={reload} /> : <PanelSkeleton />

  const canEdit = board.can_edit
  const columns = placeMoved(
    board.columns.map((c) => ({ ...c, key: c.id })),
    moved,
    (c) => c.key
  )

  async function moveTo(module, column, index) {
    setActionError(null)
    const anchors = anchorsFor(column.modules, module.id, index)
    setMoved((m) => ({ ...m, [module.id]: { columnKey: column.key, anchors } }))
    try {
      await boardsApi.placeModule(orgId, boardId, module.id, { column_id: column.id, ...anchors })
      refresh()
    } catch (err) {
      setMoved(({ [module.id]: _, ...rest }) => rest)
      setActionError(err)
    }
  }

  // The keyboard way: up / down in the column, or to the bottom of another column.
  function menuFor(module, column, index) {
    if (!canEdit) return []
    const options = []
    if (index > 0) options.push({ label: 'Move up', run: () => moveTo(module, column, index - 1) })
    if (index < column.modules.length - 1) options.push({ label: 'Move down', run: () => moveTo(module, column, index + 2) })
    for (const other of columns) {
      if (other.key !== column.key) options.push({ label: `Move to ${other.name}`, run: () => moveTo(module, other, other.modules.length) })
    }
    return options
  }

  return (
    <>
      {!opened && !editing && <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />}
      <div className={refreshing ? 'is-refreshing' : undefined}>
        <ModuleColumns
          columns={columns}
          names={names}
          canDrag={() => canEdit}
          canDropOn={() => canEdit}
          onDrop={moveTo}
          onOpen={(module) => setOpened({ module })}
          menuFor={menuFor}
          headAction={(column) =>
            canEdit && (
              <button type="button" className="board-column-menu" aria-label={`Edit column ${column.name}`} onClick={() => setEditing(column)}>
                ⋯
              </button>
            )
          }
          footerFor={(column) =>
            canEdit && (
              <AddItem
                open={adding === column.id}
                onOpen={() => setAdding(column.id)}
                onClose={() => setAdding(null)}
                onMore={() => {
                  setAdding(null)
                  setOpened({ columnId: column.id })
                }}
                onAdd={async (title) => {
                  await boardsApi.addModule(orgId, boardId, { column_id: column.id, title })
                  refresh()
                }}
              />
            )
          }
        >
          {canEdit && (
            <button type="button" className="board-add-column" onClick={() => setEditing({})}>
              + Column
            </button>
          )}
        </ModuleColumns>
      </div>

      {opened && (
        <ModuleDialog
          orgId={orgId}
          boardId={boardId}
          workUnitId={workUnitId}
          module={opened.module ?? null}
          columnId={opened.columnId}
          canEdit={canEdit}
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
      {editing && (
        <ColumnDialog
          orgId={orgId}
          board={board}
          column={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

// "+ Add item": a title, Enter to add (more details from the module's own form), Esc to stop.
function AddItem({ open, onOpen, onClose, onMore, onAdd }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!open) {
    return (
      <button type="button" className="board-add" onClick={onOpen}>
        + Add item
      </button>
    )
  }
  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(title.trim())
      setTitle('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="board-add-form" onSubmit={submit}>
      <input
        autoFocus
        aria-label="New module title"
        placeholder="Title, then Enter"
        value={title}
        maxLength={255}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      {error && <div className="field-error">{friendlyMessage(error)}</div>}
      <div className="row-actions">
        <button type="submit" className="btn small-btn" disabled={busy || !title.trim()} aria-busy={busy}>Add</button>
        <button type="button" className="btn secondary small-btn" onClick={onMore}>With details…</button>
        <button type="button" className="btn secondary small-btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

// Add or change a column: its name, description and item limit; for an existing one also its
// place on the board, and removing it (its modules go to the first column left).
function ColumnDialog({ orgId, board, column, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: column?.name ?? '',
    description: column?.description ?? '',
    wip_limit: column?.wip_limit ? String(column.wip_limit) : '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const position = column ? board.columns.findIndex((c) => c.id === column.id) : -1
  const limitValid = !form.wip_limit.trim() || (Number.isInteger(Number(form.wip_limit)) && Number(form.wip_limit) >= 1)

  async function run(call) {
    setBusy(true)
    setError(null)
    try {
      await call()
      onSaved()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      wip_limit: form.wip_limit.trim() ? Number(form.wip_limit) : null,
    }
    run(() => (column ? boardsApi.updateColumn(orgId, board.id, column.id, body) : boardsApi.addColumn(orgId, board.id, body)))
  }

  function shift(by) {
    const ids = board.columns.map((c) => c.id)
    const [id] = ids.splice(position, 1)
    ids.splice(position + by, 0, id)
    run(() => boardsApi.orderColumns(orgId, board.id, ids))
  }

  return (
    <Dialog title={column ? `Edit ${column.name}` : 'New column'} onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="column_name">Name *</label>
          <input id="column_name" value={form.name} maxLength={120} autoFocus onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="column_description">Description</label>
          <input
            id="column_description"
            value={form.description}
            maxLength={500}
            placeholder="What belongs in this column"
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="column_limit">Item limit</label>
          <input
            id="column_limit"
            type="number"
            min="1"
            max="999"
            placeholder="No limit"
            value={form.wip_limit}
            onChange={(e) => set('wip_limit', e.target.value)}
          />
          {!limitValid && <div className="field-error">A whole number from 1</div>}
          <p className="muted small">The count turns red past it; nothing is blocked.</p>
        </div>
        <div className="row-actions">
          <button type="submit" className="btn" disabled={busy || !form.name.trim() || !limitValid} aria-busy={busy}>
            {column ? 'Save' : 'Add column'}
          </button>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
      {column && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn secondary" disabled={busy || position <= 0} onClick={() => shift(-1)}>← Move left</button>
          <button type="button" className="btn secondary" disabled={busy || position >= board.columns.length - 1} onClick={() => shift(1)}>
            Move right →
          </button>
          {confirmDelete ? (
            <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => boardsApi.removeColumn(orgId, board.id, column.id))}>
              Yes, delete it
            </button>
          ) : (
            <button type="button" className="btn secondary" disabled={busy || board.columns.length <= 1} onClick={() => setConfirmDelete(true)}>
              Delete column
            </button>
          )}
        </div>
      )}
      {confirmDelete && <p className="muted small">Its modules move to the bottom of the first column left.</p>}
    </Dialog>
  )
}
