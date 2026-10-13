// Every form that can take custom fields. A form's code is the kind of record it saves (the
// backend's "object type"), so its fields show on the New page, the edit form and the
// record's page alike.
//
// `inputs` are the form's own inputs a field's "Show only when" rule may watch: `key` is
// the name the form gives the value (record forms pass their values under these names) and
// `options` the values to pick from, a list or a loader. The vertical is special: a rule on
// it decides which records the field is kept for (Identity stores it per vertical), so it
// also works on a task, whose vertical comes from its project or team.
//
// This file may read other features' lists to offer those options (see CLAUDE.md).
import { categoriesApi } from '@/features/customers/api.js'
import { BILLING_CYCLES, MANAGED_BY } from '@/features/customers/utils.js'
import { setupApi } from '@/features/delivery/api.js'
import { PROJECT_PRIORITY_LABELS, TASK_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { LEAD_SOURCES } from '@/features/sales/utils.js'

export const VERTICAL_INPUT = 'vertical_id'

const fromLabels = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))
const VERTICAL = { key: VERTICAL_INPUT, label: 'Vertical' }

export const FORM_GROUPS = ['Sales', 'Customers', 'Billing', 'Delivery', 'People', 'Documents']

// `ready`: the record can store custom field values today; the others follow one by one.
export const FORMS = [
  {
    code: 'revenue.lead',
    name: 'Lead',
    group: 'Sales',
    screens: 'New lead, lead pages',
    ready: true,
    inputs: [{ key: 'source', label: 'Source', options: fromLabels(LEAD_SOURCES) }, VERTICAL],
  },
  { code: 'revenue.opportunity', name: 'Opportunity', group: 'Sales', screens: 'Opportunity pages' },
  { code: 'revenue.quotation', name: 'Quotation', group: 'Sales', screens: 'Quotation pages' },
  { code: 'revenue.contract', name: 'Contract', group: 'Sales', screens: 'Contract form and pages' },
  { code: 'revenue.client', name: 'Customer', group: 'Customers', screens: 'New customer, customer pages' },
  {
    code: 'revenue.client_service',
    name: 'Client service',
    group: 'Customers',
    screens: 'Client service form',
    ready: true,
    inputs: [
      {
        key: 'category_id',
        label: 'Category',
        options: (orgId, opts) => categoriesApi.list(orgId, opts).then((rows) => rows.map((c) => ({ value: c.id, label: c.name }))),
      },
      { key: 'managed_by', label: 'Managed', options: fromLabels(MANAGED_BY) },
      { key: 'billing_cycle', label: 'Billed', options: fromLabels(BILLING_CYCLES) },
    ],
  },
  { code: 'billing.invoice', name: 'Invoice', group: 'Billing', screens: 'New invoice, invoice pages' },
  { code: 'billing.payment', name: 'Payment', group: 'Billing', screens: 'Record payment, payment pages' },
  {
    code: 'work.work_unit',
    name: 'Project',
    group: 'Delivery',
    screens: 'New project, project pages',
    ready: true,
    inputs: [
      {
        key: 'work_unit_type_code',
        label: 'Kind of project',
        options: (orgId, opts) => setupApi.projectTypes(orgId, opts).then((types) => types.map((t) => ({ value: t.code, label: t.name }))),
      },
      { key: 'priority', label: 'Priority', options: fromLabels(PROJECT_PRIORITY_LABELS) },
      VERTICAL,
    ],
  },
  {
    code: 'task.task',
    name: 'Task',
    group: 'Delivery',
    screens: 'New task, requests to other teams, task pages',
    ready: true,
    inputs: [
      {
        key: 'task_type_code',
        label: 'Task type',
        options: (orgId, opts) => setupApi.taskTypes(orgId, opts).then((types) => types.map((t) => ({ value: t.code, label: t.name }))),
      },
      { key: 'priority', label: 'Priority', options: fromLabels(TASK_PRIORITY_LABELS) },
      VERTICAL,
    ],
  },
  { code: 'identity.org_unit', name: 'Company unit', group: 'People', screens: 'Branches, departments and teams' },
  { code: 'identity.user', name: 'User', group: 'People', screens: 'Invite a user, user pages' },
  { code: 'document.document', name: 'Document', group: 'Documents', screens: 'Files attached to records' },
]

export const formByCode = (code) => FORMS.find((form) => form.code === code)

// { [input key]: [{ value, label }] } for a form's rule inputs other than the vertical. An
// input whose list can't be read (e.g. no access to it) offers nothing new; values already
// chosen still show.
export async function loadInputOptions(form, orgId, { signal } = {}) {
  const inputs = (form.inputs || []).filter((input) => input.key !== VERTICAL_INPUT)
  const entries = await Promise.all(
    inputs.map(async (input) => {
      if (typeof input.options !== 'function') return [input.key, input.options]
      const options = await input.options(orgId, { signal }).catch(() => [])
      return [input.key, options]
    })
  )
  return Object.fromEntries(entries)
}
