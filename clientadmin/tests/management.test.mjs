// Management pages: who sees which page, and the words and numbers they show.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import { ACCESS, hasAccess } from '../src/features/auth/access.js'
import { hours, money, percent, thisMonth } from '../src/features/management/utils.js'

const member = (...permissions) => ({ user_type: 'employee', permissions, roles: [] })

describe('management access rules', () => {
  it('shows the scorecard only with the result and period reads', () => {
    assert.equal(hasAccess(member('management.result.read', 'management.period.read'), ACCESS.scorecard), true)
    assert.equal(hasAccess(member('management.period.read'), ACCESS.scorecard), false)
  })
  it('lets either planning read open Planning', () => {
    assert.equal(hasAccess(member('management.goal.read'), ACCESS.planning), true)
    assert.equal(hasAccess(member('management.fiscal_year.read'), ACCESS.planning), true)
    assert.equal(hasAccess(member('management.budget.read'), ACCESS.planning), false)
  })
  it('keeps managing budgets apart from reading them', () => {
    const reader = member('management.budget.read')
    assert.equal(hasAccess(reader, ACCESS.budgets), true)
    assert.equal(hasAccess(reader, ACCESS.manageBudgets), false)
  })
  it('lets a client admin through every rule', () => {
    const admin = { user_type: 'client_admin', permissions: [] }
    for (const rule of [ACCESS.scorecard, ACCESS.planning, ACCESS.budgets, ACCESS.capacity, ACCESS.checkIn]) {
      assert.equal(hasAccess(admin, rule), true)
    }
  })
})

describe('management formatting', () => {
  it('shows minutes as hours', () => {
    assert.equal(hours(480), '8 h')
    assert.equal(hours(90), '1.5 h')
    assert.equal(hours(null), '—')
  })
  it('does not turn "not known" into zero', () => {
    assert.equal(percent(null), '—')
    assert.equal(percent(12.34), '12.3%')
    assert.equal(money(undefined, 'INR'), '—')
  })
  it('spans the whole month', () => {
    assert.deepEqual(thisMonth(new Date(2026, 1, 10)), { from: '2026-02-01', to: '2026-02-28' })
  })
})
