import { useRef, useState } from 'react'
import { documentCategoriesApi, documentsApi, formatFileSize, uploadDocument } from '@/features/documents/api.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const formatUploadedAt = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Files attached to one record (a quotation, a contract, ...), with upload and download.
// Drop it on any detail page; the documents service checks the user's access to the record.
//
//   canAttach        show the upload form (the record is open and the user may change it)
//   defaultCategory  category code preselected for uploads
//   linkRole         role recorded on the link, e.g. 'attachment' or 'signed_copy'
//   rowAction(doc)   optional extra action rendered on each row
//   onUploaded(doc)  called after a successful upload
export default function DocumentPanel({
  orgId,
  subjectType,
  subjectId,
  canAttach = false,
  title = 'Documents',
  defaultCategory = 'attachment',
  linkRole = 'attachment',
  emptyText = 'No files attached yet.',
  rowAction,
  onUploaded,
}) {
  const queryKey = ['documents', orgId, subjectType, subjectId]
  const { data, error: loadError, loading, reload } = useQuery(
    queryKey,
    ({ signal }) => documentsApi.listForSubject(orgId, subjectType, subjectId, { signal }),
    { enabled: Boolean(orgId && subjectId) },
  )
  const { data: categoryPage } = useLookup(
    ['document-categories', orgId],
    ({ signal }) => documentCategoriesApi.list(orgId, { signal }),
    { enabled: Boolean(orgId) && canAttach },
  )
  const categories = categoryPage?.data ?? []
  const documents = data?.data ?? []

  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [categoryCode, setCategoryCode] = useState(defaultCategory)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState(null)

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const doc = await uploadDocument(orgId, file, { categoryCode, subjectType, subjectId, linkRole })
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      invalidate(queryKey)
      onUploaded?.(doc)
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  async function download(doc) {
    setError(null)
    setDownloading(doc.id)
    try {
      const link = await documentsApi.downloadUrl(orgId, doc.id, doc.current_version.version_no)
      window.open(link.url, '_blank', 'noopener')
    } catch (err) {
      setError(err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <h2 style={{ fontSize: 17 }}>{title}</h2>
      </div>
      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />

      {canAttach && (
        <form className="inline-panel" onSubmit={handleUpload} style={{ marginTop: 0, marginBottom: 14 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`doc-file-${subjectId}`}>File</label>
              <input
                id={`doc-file-${subjectId}`}
                ref={fileInput}
                type="file"
                required
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="field">
              <label htmlFor={`doc-category-${subjectId}`}>Category</label>
              <select
                id={`doc-category-${subjectId}`}
                value={categoryCode}
                disabled={uploading}
                onChange={(e) => setCategoryCode(e.target.value)}
              >
                {categories.length === 0 && <option value={defaultCategory}>{defaultCategory}</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={!file || uploading} aria-busy={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <PanelSkeleton lines={2} />
      ) : documents.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{emptyText}</p>
      ) : (
        <table>
          <tbody>
            {documents.map((doc) => {
              const version = doc.current_version
              const link = doc.links.find((l) => l.subject.type === subjectType && l.subject.id === subjectId)
              return (
                <tr key={doc.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{doc.title}</div>
                    <div className="muted small">
                      {version ? `${version.file_name} · ${formatFileSize(version.size_bytes)}` : 'No file yet'}
                      {version && version.version_no > 1 && ` · v${version.version_no}`}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', width: 1 }}>
                    <span className="chip subtle">{doc.category.name}</span>
                    {link?.link_role && link.link_role !== 'attachment' && (
                      <span className="chip subtle" style={{ marginLeft: 6 }}>{link.link_role.replaceAll('_', ' ')}</span>
                    )}
                  </td>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    {version && (
                      <>
                        {version.uploaded_by.name}
                        <br />
                        {formatUploadedAt(version.uploaded_at)}
                      </>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', width: 1, textAlign: 'right' }}>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      {rowAction?.(doc)}
                      {version && (
                        <button
                          type="button"
                          className="btn secondary small-btn"
                          disabled={downloading === doc.id}
                          onClick={() => download(doc)}
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
