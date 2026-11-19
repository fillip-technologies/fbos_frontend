// Board rules: which steps a card may take, which columns it may be dropped on, where a dropped
// card goes, and the column head's figures.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  anchorsFor,
  columnCount,
  dropFor,
  estimateHours,
  homeColumn,
  movesFor,
  placeMoved,
  takesNewItems,
} from '../src/features/delivery/board.js'

const ME = { id: 'me' }
const task = (over = {}) => ({ id: 't', status: 'open', assignee: null, reviewer: null, task_type: { requires_review: true }, ...over })
const COLUMNS = [
  { id: 'backlog', statuses: ['draft', 'open'], is_default_for_status: false },
  { id: 'ready', statuses: ['open', 'assigned', 'rework'], is_default_for_status: false },
  { id: 'doing', statuses: ['in_progress', 'blocked'], is_default_for_status: false },
  { id: 'review', statuses: ['submitted', 'in_review'], is_default_for_status: false },
  { id: 'done', statuses: ['done'], is_default_for_status: false },
]
const col = (id) => COLUMNS.find((c) => c.id === id)

describe('movesFor', () => {
  it('lets anyone take and start unassigned work', () => {
    const moves = movesFor(task(), { me: ME })
    assert.deepStrictEqual(moves.map((m) => [m.kind, m.status]), [['claim_start', 'in_progress']])
  })
  it('submits to review or straight to done, as the type says', () => {
    const mine = { status: 'in_progress', assignee: ME }
    assert.strictEqual(movesFor(task(mine), { me: ME }).find((m) => m.kind === 'submit').status, 'submitted')
    const noReview = task({ ...mine, task_type: { requires_review: false } })
    assert.strictEqual(movesFor(noReview, { me: ME }).find((m) => m.kind === 'submit').status, 'done')
  })
  it('lets only reviewers approve or send back', () => {
    const waiting = task({ status: 'in_review', assignee: { id: 'x' } })
    assert.deepStrictEqual(movesFor(waiting, { me: ME }), [])
    assert.deepStrictEqual(movesFor(waiting, { me: ME, canReview: true }).map((m) => m.status), ['done', 'rework'])
  })
})

describe('dropFor', () => {
  it('only places a card in a column that holds its status', () => {
    assert.deepStrictEqual(dropFor(task(), col('ready'), []), { kind: 'place' })
  })
  it('takes the step to a column with another status, or refuses', () => {
    const t = task()
    assert.strictEqual(dropFor(t, col('doing'), movesFor(t, { me: ME })).kind, 'claim_start')
    assert.strictEqual(dropFor(t, col('done'), movesFor(t, { me: ME })), null)
  })
})

describe('anchorsFor', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('names the card above, else the one below', () => {
    assert.deepStrictEqual(anchorsFor(cards, 'x', 0), { before_task_id: 'a' })
    assert.deepStrictEqual(anchorsFor(cards, 'x', 2), { after_task_id: 'b' })
    assert.deepStrictEqual(anchorsFor([], 'x', 0), {})
  })
  it('leaves the dragged card itself out', () => {
    assert.deepStrictEqual(anchorsFor(cards, 'a', 3), { after_task_id: 'c' })
    assert.deepStrictEqual(anchorsFor(cards, 'c', 0), { before_task_id: 'a' })
    assert.deepStrictEqual(anchorsFor(cards, 'b', 2), { after_task_id: 'a' })
  })
})

describe('homeColumn', () => {
  it('keeps the saved column while it holds the status', () => {
    assert.strictEqual(homeColumn(COLUMNS, 'open', 'ready').id, 'ready')
    assert.strictEqual(homeColumn(COLUMNS, 'open', 'doing').id, 'backlog')
  })
  it('prefers the column marked default', () => {
    const columns = [...COLUMNS, { id: 'blocked', statuses: ['blocked'], is_default_for_status: true }]
    assert.strictEqual(homeColumn(columns, 'blocked', null).id, 'blocked')
  })
})

describe('placeMoved', () => {
  it('shows a moved card where it was dropped, with the counts', () => {
    const columns = [
      { id: 'ready', count: 2, tasks: [{ id: 'a' }, { id: 'b' }] },
      { id: 'doing', count: 1, tasks: [{ id: 'c' }] },
    ]
    const shown = placeMoved(columns, { a: { columnId: 'doing', anchors: { after_task_id: 'c' }, status: 'in_progress' } })
    assert.deepStrictEqual(shown.map((c) => c.tasks.map((t) => t.id)), [['b'], ['c', 'a']])
    assert.deepStrictEqual(shown.map((c) => c.count), [1, 2])
    assert.strictEqual(shown[1].tasks[1].status, 'in_progress')
  })
  it('reorders inside one column', () => {
    const columns = [{ id: 'ready', count: 3, tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }]
    const shown = placeMoved(columns, { c: { columnId: 'ready', anchors: { before_task_id: 'a' } } })
    assert.deepStrictEqual(shown[0].tasks.map((t) => t.id), ['c', 'a', 'b'])
    assert.strictEqual(shown[0].count, 3)
  })
})

describe('column head', () => {
  it('shows count against the limit and the estimate in hours', () => {
    assert.strictEqual(columnCount({ count: 3, wip_limit: 5 }), '3 / 5')
    assert.strictEqual(columnCount({ count: 3, wip_limit: null }), '3')
    assert.strictEqual(estimateHours(360), '6h')
    assert.strictEqual(estimateHours(90), '1.5h')
    assert.strictEqual(estimateHours(0), null)
  })
  it('offers "+ Add item" only where new work starts', () => {
    assert.strictEqual(takesNewItems(col('backlog')), true)
    assert.strictEqual(takesNewItems(col('done')), false)
  })
})
