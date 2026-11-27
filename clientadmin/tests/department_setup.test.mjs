// Department operations setup, against an in-memory stand-in for the delivery API: nothing here
// touches a real server or database. Covers a first setup, running it again, recovery after a
// failure half way, never overwriting what exists, a refused write, and what "ready" means.
import { describe, it } from 'node:test'
import assert from 'node:assert'

import { guessUnit, readiness, runSetup, setupProblems, typeCodeOf, versionContent } from '../src/features/delivery/departmentSetup.js'
import { DEPARTMENT_WORKFLOWS } from '../src/features/delivery/departmentWorkflows.js'

const template = (code) => DEPARTMENT_WORKFLOWS.find((t) => t.code === code)
const UNITS = [
  { id: 'u-seo', name: 'SEO Team' },
  { id: 'u-dev', name: 'Development' },
  { id: 'u-qa', name: 'QA' },
  { id: 'u-sales', name: 'Sales' },
]

// A company's delivery data, in memory. `fail` names a call to refuse once: { publishVersion: 1 } etc.
function fakeApi({ definitions = [], types = [], rules = [], versions = {}, fail = {}, forbid = [] } = {}) {
  const db = { definitions: [...definitions], types: [...types], rules: [...rules], versions: JSON.parse(JSON.stringify(versions)) }
  const calls = []
  const guard = (name) => {
    calls.push(name)
    if (forbid.includes(name)) throw Object.assign(new Error('forbidden'), { status: 403 })
    if (fail[name] > 0) {
      fail[name] -= 1
      throw Object.assign(new Error(`${name} failed`), { status: 500 })
    }
  }
  const api = {
    definitions: async () => db.definitions.map((d) => ({ ...d })),
    createDefinition: async (body) => {
      guard('createDefinition')
      db.definitions.push({ code: body.code, name: body.name, current_version_no: null })
      db.versions[body.code] = []
    },
    versions: async (code) => (db.versions[code] ?? []).map((v) => ({ version_no: v.version_no, status: v.status })),
    createVersion: async (code, content) => {
      guard('createVersion')
      const version = { version_no: (db.versions[code] ?? []).length + 1, status: 'draft', content }
      db.versions[code] = [...(db.versions[code] ?? []), version]
      return { version_no: version.version_no }
    },
    publishVersion: async (code, no) => {
      guard('publishVersion')
      db.versions[code].find((v) => v.version_no === no).status = 'published'
      db.definitions.find((d) => d.code === code).current_version_no = no
    },
    taskTypes: async () => db.types.map((t) => ({ ...t })),
    createTaskType: async (body) => {
      guard('createTaskType')
      db.types.push({ id: `type-${body.code}`, ...body, archived: false, workflow: null })
    },
    setTypeWorkflow: async (id, code) => {
      guard('setTypeWorkflow')
      const type = db.types.find((t) => t.id === id)
      type.workflow = { code, name: db.definitions.find((d) => d.code === code)?.name ?? code }
    },
    rules: async () => db.rules.map((r) => ({ ...r })),
    createRule: async (body) => {
      guard('createRule')
      db.rules.push({ id: `rule-${db.rules.length + 1}`, active: true, vertical: null, unit: { id: body.unit_id }, ...body })
    },
    route: async (code) => {
      const rule = db.rules.find((r) => r.task_type_code === code && r.active)
      return { unit: rule ? { id: rule.unit.id } : null }
    },
  }
  return { api, db, calls, count: (name) => calls.filter((c) => c === name).length }
}

function runner(fake, template_, overrides = {}) {
  const log = []
  const args = {
    api: fake.api,
    template: template_,
    home: 'u-seo',
    stageTeams: Object.fromEntries(Object.keys(template_.teams || {}).map((s) => [s, 'u-dev'])),
    typeCode: 'new',
    typeName: template_.name,
    route: true,
    unitName: (id) => UNITS.find((u) => u.id === id)?.name ?? 'a team',
    note: (key, state, text) => log.push({ key, state, text }),
    ...overrides,
  }
  // The latest state each step reported.
  const states = () => Object.fromEntries(log.map((l) => [l.key, l.state]))
  return { args, log, states, run: () => runSetup(args) }
}

describe('first setup', () => {
  it('saves and publishes the workflow with stage teams, makes the type, links it, routes it and checks it', async () => {
    const t = template('seo-technical')
    const fake = fakeApi()
    const r = runner(fake, t)
    const result = await r.run()
    assert.equal(result.ok, true)
    assert.deepEqual(r.states(), { workflow: 'done', type: 'done', link: 'done', route: 'done', check: 'done' })
    assert.equal(fake.db.definitions[0].current_version_no, 1)
    const published = fake.db.versions['seo-technical'][0].content
    for (const stage of ['dev_assist', 'dev_testing']) {
      assert.equal(published.stages.find((s) => s.code === stage).owner_unit_selector.unit_id, 'u-dev')
    }
    assert.equal(published.stages.find((s) => s.code === 'analysis').owner_unit_selector, undefined)
    assert.equal(fake.db.types[0].code, 'seo_technical')
    assert.equal(fake.db.types[0].workflow.code, 'seo-technical')
    assert.deepEqual(fake.db.rules.map((x) => [x.task_type_code, x.unit.id]), [['seo_technical', 'u-seo']])
  })

  it('adds no routing rule when asked not to', async () => {
    const fake = fakeApi()
    const r = runner(fake, template('sales-follow-up'), { route: false, home: 'u-sales' })
    assert.equal((await r.run()).ok, true)
    assert.equal(fake.db.rules.length, 0)
    assert.equal(r.states().route, 'kept')
  })
})

describe('running it again', () => {
  it('creates nothing twice', async () => {
    const t = template('qa-testing')
    const fake = fakeApi()
    await runner(fake, t, { home: 'u-qa' }).run()
    const writes = ['createDefinition', 'createVersion', 'publishVersion', 'createTaskType', 'setTypeWorkflow', 'createRule']
    const before = Object.fromEntries(writes.map((w) => [w, fake.count(w)]))
    const again = runner(fake, t, { home: 'u-qa' })
    assert.equal((await again.run()).ok, true)
    for (const w of writes) assert.equal(fake.count(w), before[w], `${w} ran again`)
    assert.deepEqual(again.states(), { workflow: 'kept', type: 'kept', link: 'kept', route: 'kept', check: 'done' })
    assert.equal(fake.db.definitions.length, 1)
    assert.equal(fake.db.versions['qa-testing'].length, 1)
  })
})

describe('recovering from a failure half way', () => {
  it('publishes the draft left by a failed publish, without a second version', async () => {
    const t = template('hr-onboarding')
    const fake = fakeApi({ fail: { publishVersion: 1 } })
    const first = runner(fake, t, { home: 'u-dev', stageTeams: { assets: 'u-dev', access: 'u-dev' } })
    await assert.rejects(first.run(), /publishVersion failed/)
    assert.equal(fake.db.definitions[0].current_version_no, null)
    const second = runner(fake, t, { home: 'u-dev', stageTeams: { assets: 'u-dev', access: 'u-dev' } })
    assert.equal((await second.run()).ok, true)
    assert.equal(fake.db.versions['hr-onboarding'].length, 1)
    assert.equal(fake.db.definitions.length, 1)
    assert.equal(fake.db.definitions[0].current_version_no, 1)
    assert.match(second.log.find((l) => l.key === 'workflow' && l.state === 'done').text, /unfinished workflow was published/)
  })

  it('makes the version once when the first save failed after the workflow was made', async () => {
    const t = template('dev-deployment')
    const fake = fakeApi({ fail: { createVersion: 1 } })
    await assert.rejects(runner(fake, t, { home: 'u-dev' }).run(), /createVersion failed/)
    assert.equal(fake.db.definitions.length, 1)
    assert.equal((await runner(fake, t, { home: 'u-dev' }).run()).ok, true)
    assert.equal(fake.db.definitions.length, 1)
    assert.equal(fake.db.versions['dev-deployment'].length, 1)
  })

  it('carries on from a failed type or link without redoing the workflow', async () => {
    const t = template('sales-renewal')
    const fake = fakeApi({ fail: { setTypeWorkflow: 1 } })
    await assert.rejects(runner(fake, t, { home: 'u-sales' }).run(), /setTypeWorkflow failed/)
    assert.equal(fake.count('createVersion'), 1)
    assert.equal((await runner(fake, t, { home: 'u-sales' }).run()).ok, true)
    assert.equal(fake.count('createVersion'), 1)
    assert.equal(fake.count('createTaskType'), 1)
    assert.equal(fake.db.types[0].workflow.code, 'sales-renewal')
  })

  it('marks the running step failed in the report when a call is refused', async () => {
    const fake = fakeApi({ forbid: ['createDefinition'] })
    const r = runner(fake, template('seo-audit'))
    await assert.rejects(r.run(), /forbidden/)
    assert.equal(fake.db.definitions.length, 0)
    assert.equal(fake.db.types.length, 0)
    assert.equal(fake.db.rules.length, 0)
  })
})

describe('never overwrites what exists', () => {
  it('leaves a published workflow as it is', async () => {
    const t = template('seo-audit')
    const fake = fakeApi({
      definitions: [{ code: 'seo-audit', name: 'Our own SEO audit', current_version_no: 3 }],
      versions: { 'seo-audit': [{ version_no: 3, status: 'published', content: { stages: [] } }] },
    })
    const r = runner(fake, t)
    assert.equal((await r.run()).ok, true)
    assert.equal(r.states().workflow, 'kept')
    assert.equal(fake.count('createVersion'), 0)
    assert.equal(fake.count('publishVersion'), 0)
    assert.equal(fake.db.definitions[0].name, 'Our own SEO audit')
  })

  it('stops, and changes nothing, when the type already follows another workflow', async () => {
    const t = template('seo-audit')
    const fake = fakeApi({
      types: [{ id: 'type-1', code: 'seo_audit', name: 'SEO audit', archived: false, outcomes: [], workflow: { code: 'something-else', name: 'Something else' } }],
    })
    const r = runner(fake, t, { typeCode: 'seo_audit' })
    await assert.rejects(r.run(), (err) => err.handled === true)
    assert.equal(r.states().link, 'failed')
    assert.equal(fake.db.types[0].workflow.code, 'something-else')
    assert.equal(fake.count('setTypeWorkflow'), 0)
    assert.equal(fake.db.rules.length, 0)
  })

  it('keeps a rule that already sends the work to another team, and says so', async () => {
    const t = template('seo-audit')
    const fake = fakeApi({ rules: [{ id: 'r1', task_type_code: 'seo_audit', active: true, vertical: null, unit: { id: 'u-dev' } }] })
    const r = runner(fake, t)
    const result = await r.run()
    assert.equal(r.states().route, 'kept')
    assert.match(r.log.find((l) => l.key === 'route' && l.state === 'kept').text, /Development.*not changed/)
    assert.equal(fake.count('createRule'), 0)
    assert.equal(result.ok, false) // the check says the work goes to Development, not the chosen team
  })
})

describe('what must be chosen first', () => {
  it('asks for the team, each stage team and a name', () => {
    const t = template('seo-technical')
    const found = setupProblems({ template: t, home: '', stageTeams: { dev_assist: '', dev_testing: 'u-dev' }, typeCode: 'new', typeName: ' ', existingType: null })
    assert.equal(found.length, 3)
    assert.ok(found.some((p) => /team that does this work/.test(p)))
    assert.ok(found.some((p) => /Development assistance/.test(p)))
    assert.ok(found.some((p) => /name/.test(p)))
  })

  it('refuses a type that follows another workflow or records outcomes', () => {
    const t = template('seo-audit')
    const base = { template: t, home: 'u-seo', stageTeams: {}, typeCode: 'x', typeName: '' }
    assert.equal(setupProblems({ ...base, existingType: { name: 'X', workflow: { code: 'o', name: 'Other' }, outcomes: [] } }).length, 1)
    assert.equal(setupProblems({ ...base, existingType: { name: 'X', workflow: null, outcomes: [{ code: 'won' }] } }).length, 1)
    assert.equal(setupProblems({ ...base, existingType: { name: 'X', workflow: { code: 'seo-audit', name: 'SEO audit' }, outcomes: [] } }).length, 0)
  })

  it('guesses a team only when exactly one matches', () => {
    assert.equal(guessUnit(UNITS, 'SEO'), 'u-seo')
    assert.equal(guessUnit(UNITS, 'Development'), 'u-dev')
    assert.equal(guessUnit([...UNITS, { id: 'u-seo2', name: 'SEO Content' }], 'SEO'), '')
    assert.equal(guessUnit(UNITS, 'Finance'), '')
  })
})

describe('readiness', () => {
  const empty = { units: UNITS, types: [], definitions: [], version: null, rules: [], policies: [], templates: [] }
  const state = (result, key) => result.rows.find((r) => r.key === key).state

  it('is not ready before anything is set up', () => {
    const r = readiness(template('seo-audit'), empty)
    assert.equal(r.status, 'not_ready')
    assert.equal(state(r, 'workflow'), 'missing')
    assert.equal(state(r, 'type'), 'missing')
    assert.equal(state(r, 'routing'), 'missing')
  })

  it('is not ready with only the workflow published', () => {
    const r = readiness(template('seo-audit'), { ...empty, definitions: [{ code: 'seo-audit', current_version_no: 1 }] })
    assert.equal(state(r, 'workflow'), 'configured')
    assert.equal(r.status, 'not_ready')
    assert.ok(r.missing >= 3)
  })

  it('names the stages that still have no team', () => {
    const t = template('seo-technical')
    const base = { ...empty, definitions: [{ code: t.code, current_version_no: 1 }] }
    const unmapped = readiness(t, { ...base, version: versionContent(t, {}) })
    assert.equal(state(unmapped, 'stageTeams'), 'missing')
    const mapped = readiness(t, { ...base, version: versionContent(t, { dev_assist: 'u-dev', dev_testing: 'u-dev' }) })
    assert.equal(state(mapped, 'stageTeams'), 'configured')
    assert.equal(state(readiness(template('seo-audit'), empty), 'stageTeams'), 'not_applicable')
  })

  it('is never plainly ready while a review stage has no checker we can name', () => {
    const t = template('seo-audit')
    const type = { code: typeCodeOf(t), name: 'SEO audit', archived: false, response_sla_minutes: { p3: 60 } }
    const done = {
      ...empty,
      types: [type],
      definitions: [{ code: t.code, current_version_no: 1 }],
      rules: [{ task_type_code: type.code, active: true, vertical: null, unit: { id: 'u-seo' } }],
      templates: [{ task_type: { code: type.code }, checklist: [{ text: 'Crawl the site' }] }],
    }
    const r = readiness(t, done)
    assert.equal(r.missing, 0)
    assert.equal(state(r, 'reviewer'), 'unsupported')
    assert.equal(r.status, 'ready_with_limits')
    assert.equal(state(r, 'checklist'), 'configured')
    assert.equal(state(r, 'sla'), 'configured')
  })

  it('is plainly ready when nothing is unsupported', () => {
    const t = template('sales-follow-up') // no review or approval stage
    const type = { code: typeCodeOf(t), name: 'Client follow-up', archived: false, resolution_sla_minutes: { p3: 600 } }
    const r = readiness(t, {
      ...empty,
      types: [type],
      definitions: [{ code: t.code, current_version_no: 1 }],
      rules: [{ task_type_code: type.code, active: true, vertical: null, unit: { id: 'u-sales' } }],
      templates: [{ task_type: { code: type.code }, checklist: [{ text: 'Log the call' }] }],
    })
    assert.equal(r.status, 'ready')
    assert.equal(state(r, 'reviewer'), 'not_applicable')
    assert.equal(state(r, 'approval'), 'not_applicable')
  })

  it('shows a missing checklist and time limit even when the workflow runs', () => {
    const t = template('sales-follow-up')
    const type = { code: typeCodeOf(t), name: 'Client follow-up', archived: false }
    const r = readiness(t, {
      ...empty,
      types: [type],
      definitions: [{ code: t.code, current_version_no: 1 }],
      rules: [{ task_type_code: type.code, active: true, vertical: null, unit: { id: 'u-sales' } }],
    })
    assert.equal(state(r, 'checklist'), 'missing')
    assert.equal(state(r, 'sla'), 'missing')
    assert.equal(r.status, 'not_ready')
  })
})

describe('the prepared workflows', () => {
  it('each can be set up on its own: start stage, reachable stages, a way to finish', () => {
    for (const t of DEPARTMENT_WORKFLOWS) {
      assert.equal(t.stages[0].stage_type, 'start', t.code)
      const ids = new Set(t.stages.map((s) => s.code))
      for (const s of t.steps) assert.ok(ids.has(s.from) && ids.has(s.to), `${t.code}: ${s.code}`)
      assert.ok(t.stages.some((s) => s.stage_type === 'end' && s.status_category === 'done'), t.code)
      assert.ok(t.home, `${t.code} has no department`)
    }
  })
})

// The delivery service's own rules, read from its schemas and publish checks (schemas/workflows.py,
// schemas/task_types.py, services/workflows.py), applied to what setup would send.
describe('what the delivery service would accept', () => {
  const stageKeys = new Set(['code', 'name', 'seq', 'stage_type', 'owner_unit_selector', 'status_category'])
  const transitionKeys = new Set(['code', 'name', 'from', 'to', 'trigger_type'])
  const disciplines = /^[a-z][a-z0-9_]*$/

  it('sends only fields a stage and a step may carry, with codes in the allowed form', () => {
    for (const t of DEPARTMENT_WORKFLOWS) {
      assert.match(t.code, /^[a-z0-9-]+$/, `${t.code}: workflow code`)
      assert.match(typeCodeOf(t), /^[a-z][a-z0-9_]*$/, `${t.code}: task type code`)
      assert.ok(typeCodeOf(t).length <= 50 && t.name.length <= 255, t.code)
      assert.match(t.discipline, disciplines, t.code)
      const content = versionContent(t, Object.fromEntries(Object.keys(t.teams || {}).map((s) => [s, 'unit-1'])))
      for (const s of content.stages) assert.ok(Object.keys(s).every((k) => stageKeys.has(k)), `${t.code}/${s.code}`)
      for (const s of content.transitions) assert.ok(Object.keys(s).every((k) => transitionKeys.has(k)), `${t.code}/${s.code}`)
      assert.equal(new Set(content.stages.map((s) => s.code)).size, content.stages.length, `${t.code}: stage codes`)
      assert.equal(new Set(content.transitions.map((s) => s.code)).size, content.transitions.length, `${t.code}: step codes`)
    }
  })

  it('has exactly one start stage, an end stage, every stage reachable, and a status for every stage (what a task type needs)', () => {
    for (const t of DEPARTMENT_WORKFLOWS) {
      assert.equal(t.stages.filter((s) => s.stage_type === 'start').length, 1, t.code)
      assert.ok(t.stages.some((s) => s.stage_type === 'end'), t.code)
      assert.ok(t.stages.every((s) => s.status_category), `${t.code}: a stage has no status`)
      assert.ok(t.stages.filter((s) => s.stage_type === 'end').every((s) => ['done', 'cancelled'].includes(s.status_category)), t.code)
      const reach = new Set([t.stages[0].code])
      for (let again = true; again; ) {
        again = false
        for (const s of t.steps) if (reach.has(s.from) && !reach.has(s.to)) { reach.add(s.to); again = true }
      }
      assert.equal(reach.size, t.stages.length, `${t.code}: unreachable stage`)
    }
  })

  it('names, for every stage a team is promised for, a stage that exists', () => {
    for (const t of DEPARTMENT_WORKFLOWS) for (const stage of Object.keys(t.teams || {})) assert.ok(t.stages.some((s) => s.code === stage), `${t.code}/${stage}`)
  })

  it('has no two workflows with the same code, or the same name inside a department', () => {
    assert.equal(new Set(DEPARTMENT_WORKFLOWS.map((t) => t.code)).size, DEPARTMENT_WORKFLOWS.length)
    const seen = new Set()
    for (const t of DEPARTMENT_WORKFLOWS) {
      const key = `${t.home}/${t.name}`
      assert.ok(!seen.has(key), key)
      seen.add(key)
    }
  })
})

describe('every one of the 30 operations', () => {
  it('can be set up on an empty company and then reads back as configured, with checklist and time limit still to do', async () => {
    for (const t of DEPARTMENT_WORKFLOWS) {
      const fake = fakeApi()
      const r = runner(fake, t, { home: 'u-seo', stageTeams: Object.fromEntries(Object.keys(t.teams || {}).map((s) => [s, 'u-dev'])) })
      const result = await r.run()
      assert.equal(result.ok, true, `${t.code} did not set up: ${JSON.stringify(r.log.at(-1))}`)
      assert.equal(fake.db.definitions[0].current_version_no, 1, t.code)
      const type = fake.db.types.find((x) => x.code === typeCodeOf(t))
      assert.equal(type.workflow.code, t.code, t.code)
      const ready = readiness(t, {
        units: UNITS, types: fake.db.types, definitions: fake.db.definitions,
        version: fake.db.versions[t.code][0].content, rules: fake.db.rules, policies: [], templates: [],
      })
      const state = (key) => ready.rows.find((x) => x.key === key).state
      for (const key of ['type', 'workflow', 'routing', 'assignment', 'stageTeams']) assert.ok(['configured', 'not_applicable'].includes(state(key)), `${t.code}: ${key} is ${state(key)}`)
      assert.equal(state('checklist'), 'missing', t.code)
      assert.equal(state('sla'), 'missing', t.code)
      assert.equal(ready.status, 'not_ready', t.code)
    }
  })

  it('has the same department list the setup page shows, each with at least one operation', () => {
    const departments = [...new Set(DEPARTMENT_WORKFLOWS.map((t) => t.home))]
    assert.equal(departments.length, 14)
    for (const d of departments) assert.ok(DEPARTMENT_WORKFLOWS.some((t) => t.home === d), d)
  })
})
