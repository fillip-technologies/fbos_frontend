// Project board rules: where a dropped module goes, what a column head says, and how a
// customer's board finds a module's column in its own project.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  anchorsFor,
  anchorsWithin,
  columnCount,
  estimateHours,
  hoursToMinutes,
  parseLabels,
  placeMoved,
  projectColumnNamed,
  taskProgress,
} from '../src/features/delivery/board.js'

const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('anchorsFor', () => {
  it('names the module above, else the one below', () => {
    assert.deepStrictEqual(anchorsFor(cards, 'x', 0), { before_module_id: 'a' })
    assert.deepStrictEqual(anchorsFor(cards, 'x', 2), { after_module_id: 'b' })
    assert.deepStrictEqual(anchorsFor([], 'x', 0), {})
  })
  it('leaves the dragged module itself out', () => {
    assert.deepStrictEqual(anchorsFor(cards, 'a', 3), { after_module_id: 'c' })
    assert.deepStrictEqual(anchorsFor(cards, 'c', 0), { before_module_id: 'a' })
    assert.deepStrictEqual(anchorsFor(cards, 'b', 2), { after_module_id: 'a' })
  })
})

describe('anchorsWithin', () => {
  const mixed = [{ id: 'a', p: 1 }, { id: 'b', p: 2 }, { id: 'c', p: 1 }]
  const ofOne = (m) => m.p === 1
  it('places among the same project only', () => {
    assert.deepStrictEqual(anchorsWithin(mixed, 'x', 2, ofOne), { after_module_id: 'a' })
    assert.deepStrictEqual(anchorsWithin(mixed, 'x', 0, ofOne), { before_module_id: 'a' })
    assert.deepStrictEqual(anchorsWithin(mixed, 'x', 1, (m) => m.p === 3), {})
  })
})

describe('placeMoved', () => {
  it('shows a moved module where it was dropped, with counts, estimates and limits', () => {
    const columns = [
      { id: 'ready', count: 2, wip_limit: null, modules: [{ id: 'a', estimate_minutes: 60 }, { id: 'b' }] },
      { id: 'doing', count: 1, wip_limit: 1, modules: [{ id: 'c', estimate_minutes: 30 }] },
    ]
    const shown = placeMoved(columns, { a: { columnKey: 'doing', anchors: { after_module_id: 'c' } } })
    assert.deepStrictEqual(shown.map((c) => c.modules.map((m) => m.id)), [['b'], ['c', 'a']])
    assert.deepStrictEqual(shown.map((c) => [c.count, c.estimate_minutes_total, c.over_limit]), [[1, 0, false], [2, 90, true]])
  })
  it('reorders inside a column, and goes to the bottom without an anchor', () => {
    const columns = [{ id: 'ready', count: 3, modules: [...cards] }]
    assert.deepStrictEqual(placeMoved(columns, { c: { columnKey: 'ready', anchors: { before_module_id: 'a' } } })[0].modules.map((m) => m.id), ['c', 'a', 'b'])
    assert.deepStrictEqual(placeMoved(columns, { a: { columnKey: 'ready', anchors: {} } })[0].modules.map((m) => m.id), ['b', 'c', 'a'])
  })
})

describe('column head and card', () => {
  it('shows count against the limit and the estimate in hours', () => {
    assert.strictEqual(columnCount({ count: 3, wip_limit: 5 }), '3 / 5')
    assert.strictEqual(columnCount({ count: 3, wip_limit: null }), '3')
    assert.strictEqual(estimateHours(360), '6h')
    assert.strictEqual(estimateHours(90), '1.5h')
    assert.strictEqual(estimateHours(0), null)
  })
  it('says how far the linked tasks are', () => {
    assert.strictEqual(taskProgress({ task_count: 5, tasks_done: 3 }), '3 / 5 tasks done')
    assert.strictEqual(taskProgress({ task_count: 0, tasks_done: 0 }), null)
  })
})

describe('forms', () => {
  it('reads hours and labels', () => {
    assert.strictEqual(hoursToMinutes('1.5'), 90)
    assert.strictEqual(hoursToMinutes(''), null)
    assert.strictEqual(hoursToMinutes('abc'), null)
    assert.deepStrictEqual(parseLabels(' backend, api,backend ,'), ['backend', 'api'])
  })
})

describe('projectColumnNamed', () => {
  it('matches a column by name, ignoring case and spaces', () => {
    const project = { columns: [{ id: '1', name: 'In progress' }] }
    assert.strictEqual(projectColumnNamed(project, ' in Progress').id, '1')
    assert.strictEqual(projectColumnNamed(project, 'Done'), null)
  })
})
