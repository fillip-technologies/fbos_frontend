import { api, ApiError } from '@/shared/api/http.js'
import { DOCUMENTS } from '@/shared/api/paths.js'
import { inOrg, pageQuery } from '@/shared/api/query.js'

// Record types documents attach to: `<service>.<entity>`. The documents service asks the
// owning service whether the user may see / attach to the record.
export const DOCUMENT_SUBJECTS = {
  quotation: 'revenue.quotation',
  contract: 'revenue.contract',
}

export const documentsApi = {
  // The documents attached to one record.
  listForSubject: (orgId, subjectType, subjectId, { signal } = {}) =>
    api.get(`${DOCUMENTS}/documents?${pageQuery({ limit: 100, subject_type: subjectType, subject_id: subjectId })}`, {
      headers: inOrg(orgId),
      signal,
    }),
  // { url, expires_at, file_name } — the link works for 60 seconds.
  downloadUrl: (orgId, documentId, versionNo) =>
    api.get(`${DOCUMENTS}/documents/${documentId}/versions/${versionNo}/download`, { headers: inOrg(orgId) }),
  startUpload: (orgId, body) => api.post(`${DOCUMENTS}/uploads`, body, { headers: inOrg(orgId) }),
  completeUpload: (orgId, uploadId) => api.post(`${DOCUMENTS}/uploads/${uploadId}/complete`, undefined, { headers: inOrg(orgId) }),
}

export const documentCategoriesApi = {
  list: (orgId, { signal } = {}) => api.get(`${DOCUMENTS}/document-categories`, { headers: inOrg(orgId), signal }),
  create: (orgId, body) => api.post(`${DOCUMENTS}/document-categories`, body, { headers: inOrg(orgId) }),
  update: (orgId, id, body) => api.patch(`${DOCUMENTS}/document-categories/${id}`, body, { headers: inOrg(orgId) }),
}

async function sha256Hex(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// The file goes straight to storage (ImageKit) with the signed fields the documents service
// handed out; it never passes through our servers, and our bearer token is not sent there.
async function sendToStorage(target, file) {
  const form = new FormData()
  for (const [name, value] of Object.entries(target.upload_fields || {})) form.append(name, value)
  form.append('file', file)
  let res
  try {
    res = await fetch(target.upload_url, { method: target.upload_method, headers: target.upload_headers, body: form })
  } catch (cause) {
    throw new ApiError('Unable to reach file storage.', { code: 'NETWORK_ERROR', retryable: true, cause })
  }
  if (!res.ok) throw new ApiError(`Storage rejected the file (${res.status}).`, { status: res.status, code: 'STORAGE_UPLOAD_FAILED' })
}

// Upload one file and attach it to a record: declare it → send it to storage → complete.
// Resolves to the saved document.
export async function uploadDocument(orgId, file, { categoryCode, title, subjectType, subjectId, linkRole = 'attachment' }) {
  const target = await documentsApi.startUpload(orgId, {
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    sha256: await sha256Hex(file),
    category_code: categoryCode,
    title: title || undefined,
    link: { subject: { type: subjectType, id: subjectId }, link_role: linkRole },
  })
  await sendToStorage(target, file)
  return documentsApi.completeUpload(orgId, target.upload_id)
}

export function formatFileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
