// A sale's journey: which step is done, current or next, and the one thing to do next, from
// revenue's journey answer and delivery's projects.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import { journeyStages, nextStep } from '../src/features/journey/utils.js'

const INR = (amount) => ({ amount: String(amount), currency: 'INR' })
const ALL = { approveQuotations: true, manageContracts: true, manageProjects: true, billingSchedules: true, recordPayments: true }
const base = {
  client: { id: 'c1', name: 'Acme' },
  lead: { id: 'l1', number: 'LD-1', name: 'Asha', status: 'converted' },
  opportunity: { id: 'o1', name: 'Website', status: 'won', amount: INR(100000) },
  quotations: [{ id: 'q1', number: 'Q-1', status: 'accepted', is_main: true, amount: INR(118000) }],
  contracts: [{ id: 'k1', number: 'CT-1', status: 'active' }],
  invoices: [],
  payments: [],
  totals: { invoiced: INR(0), received: INR(0), balance_due: INR(0) },
  hidden: [],
}
const states = (stages) => Object.fromEntries(stages.map((s) => [s.key, s.state]))

describe('journeyStages', () => {
  it('marks what is done and what comes next', () => {
    const stages = journeyStages(base, [], { canSeeProjects: true })
    assert.deepStrictEqual(states(stages), {
      lead: 'done', opportunity: 'done', quotation: 'done', contract: 'done', project: 'todo', invoice: 'todo', paid: 'todo',
    })
    assert.strictEqual(stages.find((s) => s.key === 'contract').to, '/contracts/k1')
  })

  it('leaves out delivery for someone who cannot see projects', () => {
    const keys = journeyStages(base, [], { canSeeProjects: false }).map((s) => s.key)
    assert.ok(!keys.includes('project'))
  })

  it('says a stage is hidden, not missing, when the person may not read it', () => {
    const stages = journeyStages({ ...base, lead: null, invoices: [], hidden: ['lead', 'invoices'] }, [], { canSeeProjects: false })
    assert.strictEqual(states(stages).lead, 'hidden')
    assert.strictEqual(states(stages).invoice, 'hidden')
    assert.strictEqual(states(stages).paid, 'hidden')
  })

  it('a qualified enquiry hands over to its opportunity', () => {
    const open = { ...base, lead: { ...base.lead, status: 'qualified' }, opportunity: { ...base.opportunity, status: 'qualification' }, quotations: [], contracts: [] }
    const stages = journeyStages(open, [], { canSeeProjects: false })
    assert.strictEqual(states(stages).lead, 'done')
    assert.strictEqual(states(stages).opportunity, 'current')
    assert.match(nextStep(open, stages, [], ALL).text, /Prepare a quotation/)
  })

  it('an enquiry still being called is the step to work on', () => {
    const calling = { ...base, lead: { ...base.lead, status: 'contacted' }, opportunity: null, quotations: [], contracts: [] }
    const stages = journeyStages(calling, [], { canSeeProjects: false })
    assert.strictEqual(states(stages).lead, 'current')
    assert.match(nextStep(calling, stages, [], ALL).text, /qualify it/)
  })

  it('a deal without an enquiry skips that step', () => {
    assert.strictEqual(states(journeyStages({ ...base, lead: null }, [], { canSeeProjects: false })).lead, 'skipped')
  })

  it('counts money still owed, and overdue invoices, on the paid step', () => {
    const journey = {
      ...base,
      invoices: [
        { id: 'i1', status: 'paid', kind: 'tax_invoice' },
        { id: 'i2', status: 'overdue', kind: 'tax_invoice' },
        { id: 'i3', status: 'draft', kind: 'tax_invoice' },
      ],
      totals: { invoiced: INR(118000), received: INR(59000), balance_due: INR(59000) },
    }
    const stages = journeyStages(journey, [], { canSeeProjects: false })
    assert.strictEqual(states(stages).invoice, 'done')
    assert.strictEqual(states(stages).paid, 'late')
    assert.match(stages.find((s) => s.key === 'invoice').title, /^2 invoices$/)
  })
})

describe('nextStep', () => {
  const next = (journey, projects = [], can = ALL) => nextStep(journey, journeyStages(journey, projects, { canSeeProjects: true }), projects, can)

  it('an active contract with no project offers to start one, filled in', () => {
    const step = next(base)
    assert.strictEqual(step.action.to, '/projects/new?customer=c1&contract=k1')
  })

  it('once delivery is running, points to billing', () => {
    const step = next(base, [{ id: 'p1', name: 'Build', status: 'active' }])
    assert.strictEqual(step.action.to, '/billing-schedules?contract=k1')
  })

  it('money owed offers to record the payment against the open invoice', () => {
    const journey = {
      ...base,
      invoices: [{ id: 'i2', status: 'issued', kind: 'tax_invoice' }],
      totals: { invoiced: INR(1000), received: INR(0), balance_due: INR(1000) },
    }
    const step = next(journey, [{ id: 'p1', status: 'active' }])
    assert.strictEqual(step.action.to, '/payments/new?customer=c1&invoice=i2')
  })

  it('without the permission, says what is next but offers no button', () => {
    const step = next(base, [], { ...ALL, manageProjects: false, billingSchedules: false })
    assert.ok(step.text)
    assert.strictEqual(step.action, null)
  })

  it('a quotation waiting for approval says so to the approver', () => {
    const journey = {
      ...base,
      opportunity: { ...base.opportunity, status: 'proposal' },
      quotations: [{ id: 'q2', number: 'Q-2', status: 'pending_approval', is_main: true }],
      contracts: [],
    }
    const step = next(journey)
    assert.match(step.text, /waiting for your approval/)
    assert.strictEqual(step.action.to, '/quotations/q2')
  })

  it('a lost deal has nothing to do', () => {
    const journey = { ...base, opportunity: { ...base.opportunity, status: 'lost' }, contracts: [] }
    assert.strictEqual(next(journey).tone, 'lost')
  })

  it('paid in full is the end', () => {
    const journey = {
      ...base,
      invoices: [{ id: 'i1', status: 'paid', kind: 'tax_invoice' }],
      totals: { invoiced: INR(1000), received: INR(1000), balance_due: INR(0) },
    }
    assert.strictEqual(next(journey, [{ id: 'p1', status: 'completed' }]).tone, 'done')
  })
})
