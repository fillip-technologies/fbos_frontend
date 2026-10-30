import { api } from '@/shared/api/http.js'
import { PEOPLE } from '@/shared/api/paths.js'

function toQuery(params = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      if (Array.isArray(v)) v.forEach((item) => q.append(k, item))
      else q.set(k, String(v))
    }
  }
  const str = q.toString()
  return str ? `?${str}` : ''
}

// -------------------------------------------------------------
// Workers & Position Management
// -------------------------------------------------------------
export const getWorkers = (params = {}) => api.get(`${PEOPLE}/workers${toQuery(params)}`)
export const getWorker = (id) => api.get(`${PEOPLE}/workers/${id}`)
export const createWorker = (data) => api.post(`${PEOPLE}/workers`, data)
export const updateWorker = (id, data) => api.patch(`${PEOPLE}/workers/${id}`, data)
// Active employee users of identity that have no employee record yet, and creating records from them.
export const getImportableUsers = (params = {}) => api.get(`${PEOPLE}/workers/importable-users${toQuery(params)}`)
export const importWorkersFromUsers = (users) => api.post(`${PEOPLE}/workers/import-from-users`, { users })
export const addTimelineEvent = (id, data) => api.post(`${PEOPLE}/workers/${id}/timeline`, data)

// ID documents and the onboarding checklist. Numbers come back masked; `reveal*` returns the full value and is logged.
export const getOnboarding = (id) => api.get(`${PEOPLE}/workers/${id}/onboarding`)
export const saveWorkerDocument = (id, type, data) => api.put(`${PEOPLE}/workers/${id}/documents/${type}`, data)
export const verifyWorkerDocument = (id, type) => api.post(`${PEOPLE}/workers/${id}/documents/${type}/verify`)
export const rejectWorkerDocument = (id, type, reason) =>
  api.post(`${PEOPLE}/workers/${id}/documents/${type}/reject`, { reason })
export const revealDocumentNumber = (id, type) => api.get(`${PEOPLE}/workers/${id}/documents/${type}/number`)
export const getOnboardingRequirements = () => api.get(`${PEOPLE}/onboarding/requirements`)
export const saveOnboardingRequirements = (required) => api.put(`${PEOPLE}/onboarding/requirements`, { required })

// Bank accounts
export const getBankAccounts = (id) => api.get(`${PEOPLE}/workers/${id}/bank-accounts`)
export const createBankAccount = (id, data) => api.post(`${PEOPLE}/workers/${id}/bank-accounts`, data)
export const updateBankAccount = (id, accountId, data) => api.patch(`${PEOPLE}/workers/${id}/bank-accounts/${accountId}`, data)
export const makePrimaryBankAccount = (id, accountId) => api.post(`${PEOPLE}/workers/${id}/bank-accounts/${accountId}/primary`)
export const verifyBankAccount = (id, accountId) => api.post(`${PEOPLE}/workers/${id}/bank-accounts/${accountId}/verify`)
export const deactivateBankAccount = (id, accountId) => api.post(`${PEOPLE}/workers/${id}/bank-accounts/${accountId}/deactivate`)
export const revealBankAccountNumber = (id, accountId) => api.get(`${PEOPLE}/workers/${id}/bank-accounts/${accountId}/number`)

export const getPositions = (params = {}) => api.get(`${PEOPLE}/positions${toQuery(params)}`)
export const createPosition = (data) => api.post(`${PEOPLE}/positions`, data)
export const getJobProfiles = () => api.get(`${PEOPLE}/job-profiles`)
export const createJobProfile = (data) => api.post(`${PEOPLE}/job-profiles`, data)
export const getPayBands = () => api.get(`${PEOPLE}/pay-bands`)
export const createPayBand = (data) => api.post(`${PEOPLE}/pay-bands`, data)

// -------------------------------------------------------------
// Recruitment & ATS
// -------------------------------------------------------------
export const getRequisitions = (params = {}) => api.get(`${PEOPLE}/requisitions${toQuery(params)}`)
export const createRequisition = (data) => api.post(`${PEOPLE}/requisitions`, data)
export const getRequisition = (id) => api.get(`${PEOPLE}/requisitions/${id}`)

export const getCandidates = (params = {}) => api.get(`${PEOPLE}/candidates${toQuery(params)}`)
export const createCandidate = (data) => api.post(`${PEOPLE}/candidates`, data)
export const getCandidate = (id) => api.get(`${PEOPLE}/candidates/${id}`)

export const getApplications = (params = {}) => api.get(`${PEOPLE}/applications${toQuery(params)}`)
export const applyCandidate = (data) => api.post(`${PEOPLE}/applications`, data)
export const transitionApplicationStage = (id, data) => api.post(`${PEOPLE}/applications/${id}/stage`, data)
export const getScorecards = (id) => api.get(`${PEOPLE}/applications/${id}/scorecards`)
export const submitScorecard = (id, data) => api.post(`${PEOPLE}/applications/${id}/scorecards`, data)
export const createOffer = (id, data) => api.post(`${PEOPLE}/applications/${id}/offers`, data)
export const acceptAndOnboardCandidate = (id, data) => api.post(`${PEOPLE}/offers/${id}/accept-and-onboard`, data)

// -------------------------------------------------------------
// Attendance, Shifts & Overtime
// -------------------------------------------------------------
export const getShifts = () => api.get(`${PEOPLE}/shifts`)
export const createShift = (data) => api.post(`${PEOPLE}/shifts`, data)

export const getAttendance = (params = {}) => api.get(`${PEOPLE}/attendance${toQuery(params)}`)
export const clockIn = (data) => api.post(`${PEOPLE}/attendance/clock-in`, data)
export const clockOut = (data) => api.post(`${PEOPLE}/attendance/clock-out`, data)
export const recordAttendance = (data) => api.post(`${PEOPLE}/attendance/record`, data)

export const claimOvertime = (data) => api.post(`${PEOPLE}/overtime/claims`, data)
export const approveOvertime = (id, approved = true) => api.patch(`${PEOPLE}/overtime/claims/${id}/approve?approved=${approved}`)

export const createRegularization = (data) => api.post(`${PEOPLE}/attendance/regularizations`, data)
export const approveRegularization = (id, approved = true) => api.patch(`${PEOPLE}/attendance/regularizations/${id}/approve?approved=${approved}`)

// -------------------------------------------------------------
// Leaves & Double-entry Ledger
// -------------------------------------------------------------
export const getLeavePlans = () => api.get(`${PEOPLE}/leave-plans`)
export const createLeavePlan = (data) => api.post(`${PEOPLE}/leave-plans`, data)

export const getWorkerBalances = (workerId) => api.get(`${PEOPLE}/leaves/balances/${workerId}`)
export const adjustLeaveBalance = (data) => api.post(`${PEOPLE}/leaves/adjust-balance`, data)

export const getLeaveRequests = (params = {}) => api.get(`${PEOPLE}/leaves/requests${toQuery(params)}`)
export const submitLeaveRequest = (data) => api.post(`${PEOPLE}/leaves/requests`, data)
export const approveLeaveRequest = (id, approved = true) => api.patch(`${PEOPLE}/leaves/requests/${id}/approve?approved=${approved}`)

// -------------------------------------------------------------
// Compensation, Payroll & Reimbursements
// -------------------------------------------------------------
export const getSalaryStructure = (workerId) => api.get(`${PEOPLE}/salary-structures/${workerId}`)
export const createSalaryStructure = (data) => api.post(`${PEOPLE}/salary-structures`, data)

export const getReimbursements = (params = {}) => api.get(`${PEOPLE}/reimbursements${toQuery(params)}`)
export const submitReimbursement = (data) => api.post(`${PEOPLE}/reimbursements`, data)
export const approveReimbursement = (id, approved = true) => api.patch(`${PEOPLE}/reimbursements/${id}/approve?approved=${approved}`)

export const getPayrollRuns = () => api.get(`${PEOPLE}/payroll/runs`)
export const createPayrollRun = (data) => api.post(`${PEOPLE}/payroll/runs`, data)
export const getPayrollRunDetail = (id) => api.get(`${PEOPLE}/payroll/runs/${id}`)
export const disbursePayrollRun = (id) => api.post(`${PEOPLE}/payroll/runs/${id}/disburse`)

// -------------------------------------------------------------
// Appraisals, Promotions & Bonuses
// -------------------------------------------------------------
export const getCompensationRevisions = (workerId) => api.get(`${PEOPLE}/workers/${workerId}/compensation-revisions`)
export const createCompensationRevision = (workerId, data) => api.post(`${PEOPLE}/workers/${workerId}/compensation-revisions`, data)

export const getPromotions = (workerId) => api.get(`${PEOPLE}/workers/${workerId}/promotions`)
export const createPromotion = (workerId, data) => api.post(`${PEOPLE}/workers/${workerId}/promotions`, data)

export const getBonuses = (workerId) => api.get(`${PEOPLE}/workers/${workerId}/bonuses`)
export const awardBonus = (workerId, data) => api.post(`${PEOPLE}/workers/${workerId}/bonuses`, data)

// -------------------------------------------------------------
// Separation & Clearance
// -------------------------------------------------------------
export const getSeparations = (params = {}) => api.get(`${PEOPLE}/separations${toQuery(params)}`)
export const initiateSeparation = (data) => api.post(`${PEOPLE}/separations`, data)
export const getSeparationDetail = (id) => api.get(`${PEOPLE}/separations/${id}`)
export const updateClearance = (id, data) => api.patch(`${PEOPLE}/separations/${id}/clearance`, data)
export const calculateSettlement = (id) => api.post(`${PEOPLE}/separations/${id}/settlement`)
export const finalizeExit = (id) => api.post(`${PEOPLE}/separations/${id}/finalize`)
