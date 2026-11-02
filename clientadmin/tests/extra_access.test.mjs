// Someone People manages: what an access edit adds or changes ends on the chosen date; what was already
// there and is sent back unchanged (their job access) keeps its own end date, as Identity checks.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import { withExtraAccessEnd } from '../src/features/access/permissions.js'

const held = [
  { code: 'identity.user.read', scope_unit: null, self_only: false, valid_to: null }, // from their job
  { code: 'people.leave.apply', scope_unit: { id: 'u1' }, self_only: true, valid_to: '2026-12-01T00:00:00Z' },
]
const applied = [{ role: { id: 'job-role' }, scope_unit: null, self_only: false, valid_to: null }]

describe('withExtraAccessEnd', () => {
  const body = {
    permissions: [
      { code: 'identity.user.read', scope_unit_id: null, self_only: false },
      { code: 'people.leave.apply', scope_unit_id: 'u1', self_only: true, valid_to: '2026-12-01T00:00:00Z' },
      { code: 'identity.org_unit.read', scope_unit_id: null, self_only: false }, // added now
      { code: 'people.leave.apply', scope_unit_id: null, self_only: false }, // a new scope
    ],
    role_assignments: [
      { role_id: 'job-role', scope_unit_id: null, self_only: false },
      { role_id: 'auditor', scope_unit_id: null, self_only: false }, // added now
    ],
  }
  const out = withExtraAccessEnd(body, held, applied, '2026-12-31')
  const end = new Date('2026-12-31T23:59:00').toISOString()

  it('leaves what was held unchanged, job access included', () => {
    assert.equal(out.permissions[0].valid_to, undefined)
    assert.equal(out.permissions[1].valid_to, '2026-12-01T00:00:00Z')
    assert.equal(out.role_assignments[0].valid_to, undefined)
  })

  it('ends what is added now on the chosen date', () => {
    assert.equal(out.permissions[2].valid_to, end)
    assert.equal(out.permissions[3].valid_to, end)
    assert.equal(out.role_assignments[1].valid_to, end)
  })

  it('treats a changed "own records only" switch as a change', () => {
    const changed = withExtraAccessEnd(
      { permissions: [{ code: 'identity.user.read', scope_unit_id: null, self_only: true }] }, held, applied, '2026-12-31',
    )
    assert.equal(changed.permissions[0].valid_to, end)
    assert.equal(changed.role_assignments, undefined) // presets not sent stay unsent
  })
})
