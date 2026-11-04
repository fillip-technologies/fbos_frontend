// The CEO Command Center's helpers: periods and the change against the period before.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import { change, periodFor, trendTotal } from '../src/features/ceo/utils.js'

describe('periodFor', () => {
  const today = new Date(2026, 10, 18) // 18 Nov 2026
  it('this month runs from the 1st to today', () => {
    assert.deepStrictEqual(periodFor('this_month', today), { from: '2026-11-01', to: '2026-11-18' })
  })
  it('last month is the whole previous month', () => {
    assert.deepStrictEqual(periodFor('last_month', today), { from: '2026-10-01', to: '2026-10-31' })
  })
  it('12 months starts on the 1st of the month eleven months back', () => {
    assert.deepStrictEqual(periodFor('last_12_months', today), { from: '2025-12-01', to: '2026-11-18' })
  })
  it('an unknown range falls back to this month', () => {
    assert.deepStrictEqual(periodFor('nope', today), { from: '2026-11-01', to: '2026-11-18' })
  })
})

describe('change', () => {
  it('more revenue is good, more cost is bad', () => {
    assert.deepStrictEqual(change(150, 100), { text: '+50% vs previous period', tone: 'good' })
    assert.deepStrictEqual(change(150, 100, { higherIsBetter: false }), { text: '+50% vs previous period', tone: 'bad' })
    assert.deepStrictEqual(change(50, 100), { text: '-50% vs previous period', tone: 'bad' })
  })
  it('nothing before is not a percentage', () => {
    assert.deepStrictEqual(change(10, 0), { text: 'New this period', tone: '' })
    assert.deepStrictEqual(change(0, 0), { text: 'Same as before', tone: '' })
  })
  it('no previous figure means no comparison', () => {
    assert.strictEqual(change(10, null), null)
    assert.strictEqual(change(null, 10), null)
  })
})

describe('trendTotal', () => {
  it('adds up the months that are recorded', () => {
    assert.strictEqual(trendTotal([{ profit: 100 }, { profit: null }, { profit: -40 }], 'profit'), 60)
  })
  it('is null when no month is recorded, never zero', () => {
    assert.strictEqual(trendTotal([{ revenue: null }, { revenue: null }], 'revenue'), null)
    assert.strictEqual(trendTotal(undefined, 'revenue'), null)
  })
})
