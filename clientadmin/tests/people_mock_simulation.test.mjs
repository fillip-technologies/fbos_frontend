import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  toList,
  toItem,
  WORKER_STATUS_BADGES,
  ATTENDANCE_STATUS_BADGES,
  REQUISITION_STATUS_BADGES,
} from '../src/features/people/utils.js'

import { ACCESS } from '../src/features/auth/access.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('People Utils & Defensive Formatting Logic', () => {
  it('formats currency safely across valid, zero, negative, and invalid values', () => {
    assert.strictEqual(formatCurrency(180000, 'USD'), '$180,000.00')
    assert.strictEqual(formatCurrency(0, 'USD'), '$0.00')
    assert.strictEqual(formatCurrency('1500.50', 'USD'), '$1,500.50')
    assert.strictEqual(formatCurrency(null), '-')
    assert.strictEqual(formatCurrency(undefined), '-')
    assert.strictEqual(formatCurrency(''), '-')
    assert.strictEqual(formatCurrency('not_a_number'), '-')
  })

  it('formats dates safely without crashing or emitting "Invalid Date"', () => {
    const formatted = formatDate('2026-06-01')
    assert.ok(formatted.includes('2026'))
    assert.strictEqual(formatDate(null), '-')
    assert.strictEqual(formatDate(undefined), '-')
    assert.strictEqual(formatDate(''), '-')
    assert.strictEqual(formatDate('not-a-valid-date'), 'not-a-valid-date')
  })

  it('formats date-time values safely', () => {
    const formatted = formatDateTime('2026-06-01T09:30:00Z')
    assert.ok(formatted.includes('2026'))
    assert.strictEqual(formatDateTime(null), '-')
    assert.strictEqual(formatDateTime('invalid_dt'), 'invalid_dt')
  })

  it('toList normalizes both raw arrays and paginated response envelopes', () => {
    const rawArray = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]
    assert.deepStrictEqual(toList(rawArray), rawArray)

    const paginated = { data: rawArray, page: { limit: 25, has_more: false } }
    assert.deepStrictEqual(toList(paginated), rawArray)

    assert.deepStrictEqual(toList(null), [])
    assert.deepStrictEqual(toList(undefined), [])
    assert.deepStrictEqual(toList({}), [])
    assert.deepStrictEqual(toList('string'), [])
  })

  it('toItem normalizes single entity responses whether wrapped or bare', () => {
    const worker = { id: '1', first_name: 'Alice', worker_code: 'EMP-2026-0001' }
    assert.deepStrictEqual(toItem(worker), worker)
    assert.deepStrictEqual(toItem({ data: worker }), worker)
    assert.strictEqual(toItem(null), null)
    assert.strictEqual(toItem(undefined), null)
  })

  it('contains badge styles for all standard worker and attendance statuses', () => {
    for (const status of ['active', 'probation', 'on_leave', 'noticed', 'exited']) {
      assert.ok(typeof WORKER_STATUS_BADGES[status] === 'string' && WORKER_STATUS_BADGES[status].length > 0)
    }
    for (const status of ['present', 'half_day', 'absent', 'holiday', 'on_leave', 'regularized']) {
      assert.ok(typeof ATTENDANCE_STATUS_BADGES[status] === 'string' && ATTENDANCE_STATUS_BADGES[status].length > 0)
    }
    for (const status of ['open', 'draft', 'paused', 'filled', 'cancelled']) {
      assert.ok(typeof REQUISITION_STATUS_BADGES[status] === 'string' && REQUISITION_STATUS_BADGES[status].length > 0)
    }
  })
})

describe('People Permissions & Access Rules', () => {
  it('defines RBAC access permissions for all People modules', () => {
    assert.ok(ACCESS.people.anyPermissions.includes('people.employee.read'))
    assert.ok(ACCESS.manageEmployees.permissions.includes('people.employee.manage'))
    assert.ok(ACCESS.recruitment.permissions.includes('people.recruitment.read'))
    assert.ok(ACCESS.attendance.permissions.includes('people.attendance.read'))
    assert.ok(ACCESS.leaves.permissions.includes('people.leave.apply'))
    assert.ok(ACCESS.compensation.permissions.includes('people.compensation.read'))
    assert.ok(ACCESS.manageSeparation.permissions.includes('people.separation.manage'))
  })
})

describe('People Router & Lazy Chunks Integration', () => {
  it('verifies that all 7 People page source files exist on disk', () => {
    const peoplePages = [
      'EmployeeDirectory.jsx',
      'EmployeeDetail.jsx',
      'RecruitmentJobs.jsx',
      'AttendanceBoard.jsx',
      'LeaveManager.jsx',
      'PayrollHub.jsx',
      'SeparationManager.jsx',
    ]

    for (const pageName of peoplePages) {
      const pagePath = path.join(rootDir, 'src', 'features', 'people', 'pages', pageName)
      assert.ok(fs.existsSync(pagePath), `Page file missing on disk: ${pagePath}`)
      const content = fs.readFileSync(pagePath, 'utf-8')
      assert.ok(content.length > 500, `Page file ${pageName} is suspiciously short`)
      assert.ok(content.includes('export default'), `Page file ${pageName} does not export default`)
    }
  })

  it('verifies that pages.js registers dynamic imports for all People pages', () => {
    const pagesJsPath = path.join(rootDir, 'src', 'app', 'pages.js')
    const pagesJsContent = fs.readFileSync(pagesJsPath, 'utf-8')

    const pageMapping = [
      { key: 'Employees', file: 'EmployeeDirectory.jsx' },
      { key: 'EmployeeDetail', file: 'EmployeeDetail.jsx' },
      { key: 'RecruitmentJobs', file: 'RecruitmentJobs.jsx' },
      { key: 'AttendanceBoard', file: 'AttendanceBoard.jsx' },
      { key: 'LeaveManager', file: 'LeaveManager.jsx' },
      { key: 'PayrollHub', file: 'PayrollHub.jsx' },
      { key: 'SeparationManager', file: 'SeparationManager.jsx' },
    ]

    for (const { key, file } of pageMapping) {
      const regex = new RegExp(`${key}:\\s*\\(\\)\\s*=>\\s*import\\('@/features/people/pages/${file.replace('.', '\\.')}'\\)`)
      assert.ok(regex.test(pagesJsContent), `pages.js missing loader for ${key} -> ${file}`)
    }
  })

  it('verifies that App.jsx defines routes for all People pages', () => {
    const appJsxPath = path.join(rootDir, 'src', 'app', 'App.jsx')
    const appJsxContent = fs.readFileSync(appJsxPath, 'utf-8')

    const expectedRoutes = [
      '/people/employees',
      '/people/employees/:id',
      '/people/jobs',
      '/people/attendance',
      '/people/leaves',
      '/people/payroll',
      '/people/offboarding',
    ]

    for (const route of expectedRoutes) {
      assert.ok(appJsxContent.includes(route), `App.jsx missing route: ${route}`)
    }
  })
})
