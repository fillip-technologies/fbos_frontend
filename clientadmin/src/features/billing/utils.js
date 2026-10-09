import { todayIso } from '@/shared/utils/dates.js'

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'overdue', 'paid', 'cancelled', 'written_off']
// Invoices a payment can be allocated to.
export const PAYABLE_STATUSES = ['issued', 'partially_paid', 'overdue']
export const DOC_TYPES = { tax_invoice: 'Tax invoice', credit_note: 'Credit note', debit_note: 'Debit note', proforma: 'Proforma' }
// Documents a payment can settle.
export const PAYABLE_DOC_TYPES = ['tax_invoice', 'debit_note']
export const CREDIT_REASONS = {
  price_correction: 'Price correction',
  service_deficiency: 'Service deficiency',
  cancellation: 'Cancellation',
  return: 'Goods returned',
  other: 'Other',
}
export const DEBIT_REASONS = {
  price_correction: 'Undercharged',
  additional_charges: 'Additional charges',
  other: 'Other',
}
export const SCHEDULE_LINE_STATUSES = { planned: 'Planned', ready: 'Ready', invoiced: 'Invoiced', cancelled: 'Cancelled' }
export const PAYMENT_METHODS = {
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  card: 'Card',
  gateway: 'Payment gateway',
  cash: 'Cash',
}
export const CASE_STATUSES = ['open', 'promised', 'escalated', 'resolved', 'written_off']
export const LIVE_CASE_STATUSES = ['open', 'promised', 'escalated']
export const FOLLOW_UP_CHANNELS = { call: 'Call', email: 'Email', whatsapp: 'WhatsApp', visit: 'Visit', letter: 'Letter' }
export const FOLLOW_UP_OUTCOMES = {
  promised: 'Promised to pay',
  disputed: 'Disputed',
  no_response: 'No response',
  paid: 'Says it is paid',
  escalate: 'Escalate',
}

export const amountOf = (money) => Number(money?.amount || 0)

// An issued invoice or debit note that still owes money.
export const isPayable = (inv) =>
  PAYABLE_DOC_TYPES.includes(inv.doc_type) && PAYABLE_STATUSES.includes(inv.status) && amountOf(inv.balance_due) > 0

// TDS the customer is expected to withhold on an invoice (shown on it, never part of its total).
export const expectedTds = (inv) => (inv.withholding || []).reduce((sum, item) => sum + amountOf(item.amount), 0)

// Unpaid money past its due date, even before a collections refresh marks it overdue.
export const isPastDue = (inv) =>
  PAYABLE_STATUSES.includes(inv.status) && inv.due_date && inv.due_date < todayIso() && amountOf(inv.balance_due) > 0

export const round2 = (n) => Math.round(n * 100) / 100
