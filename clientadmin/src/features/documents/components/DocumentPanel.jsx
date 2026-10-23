import { useRef, useState } from 'react'
import { documentCategoriesApi, documentsApi, formatFileSize, uploadDocument } from '@/features/documents/api.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const formatUploadedAt = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function getFileTypeBadge(fileName = '', mimeType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = (mimeType || '').toLowerCase()
  if (mime.includes('pdf') || ext === 'pdf') {
    return { label: 'PDF', icon: '📄', isPreviewable: true, style: { background: '#fee2e2', color: '#991b1b' } }
  }
  if (mime.includes('word') || ['doc', 'docx'].includes(ext)) {
    return { label: 'DOCX', icon: '📝', isPreviewable: false, style: { background: '#dbeafe', color: '#1e40af' } }
  }
  if (mime.includes('excel') || mime.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return { label: 'EXCEL', icon: '📊', isPreviewable: false, style: { background: '#dcfce7', color: '#166534' } }
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return { label: 'IMAGE', icon: '🖼️', isPreviewable: true, isImage: true, style: { background: '#f3e8ff', color: '#6b21a8' } }
  }
  if (mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { label: 'ZIP', icon: '📦', isPreviewable: false, style: { background: '#fef3c7', color: '#92400e' } }
  }
  return { label: ext ? ext.toUpperCase() : 'FILE', icon: '📁', isPreviewable: false, style: { background: '#f1f5f9', color: '#475569' } }
}

// Files attached to one record (project, contract, quotation, ...), with bulk upload, download and view.
// Drop it on any detail page; the documents service checks the user's access to the record.
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
  const [files, setFiles] = useState([])
  const [categoryCode, setCategoryCode] = useState(defaultCategory)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  async function handleUpload(e) {
    e.preventDefault()
    if (files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const currentFile = files[i]
        setUploadStatus(files.length > 1 ? `Uploading ${i + 1} of ${files.length}: ${currentFile.name}…` : 'Uploading…')
        const doc = await uploadDocument(orgId, currentFile, { categoryCode, subjectType, subjectId, linkRole })
        onUploaded?.(doc)
      }
      setFiles([])
      if (fileInput.current) fileInput.current.value = ''
      invalidate(queryKey)
    } catch (err) {
      setError(err)
      invalidate(queryKey)
    } finally {
      setUploading(false)
      setUploadStatus('')
    }
  }

  async function openOrDownload(doc) {
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

  const totalSelectedSize = files.reduce((acc, f) => acc + (f.size || 0), 0)

  const filteredDocuments = documents.filter((doc) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const fileName = doc.current_version?.file_name?.toLowerCase() || ''
    const titleText = doc.title?.toLowerCase() || ''
    const catName = doc.category?.name?.toLowerCase() || ''
    return fileName.includes(q) || titleText.includes(q) || catName.includes(q)
  })

  return (
    <div className="panel">
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>
          {title} {documents.length > 0 && <span className="muted small">({documents.length})</span>}
        </h2>
        {documents.length > 3 && (
          <input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, padding: '4px 8px', fontSize: 13 }}
          />
        )}
      </div>
      <ErrorBanner error={error || loadError} onRetry={error ? undefined : reload} />

      {canAttach && (
        <form className="inline-panel" onSubmit={handleUpload} style={{ marginTop: 12, marginBottom: 14 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={`doc-files-${subjectId}`}>
                Files {files.length > 1 && <span className="muted small">({files.length} selected · {formatFileSize(totalSelectedSize)})</span>}
              </label>
              <input
                id={`doc-files-${subjectId}`}
                ref={fileInput}
                type="file"
                multiple
                required
                disabled={uploading}
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
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
          <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn" type="submit" disabled={files.length === 0 || uploading} aria-busy={uploading}>
              {uploading ? (uploadStatus || 'Uploading…') : files.length > 1 ? `Upload ${files.length} Files` : 'Upload File'}
            </button>
            {files.length > 0 && !uploading && (
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={() => {
                  setFiles([])
                  if (fileInput.current) fileInput.current.value = ''
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <PanelSkeleton lines={2} />
      ) : documents.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{emptyText}</p>
      ) : filteredDocuments.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>No documents match "{search}".</p>
      ) : (
        <table>
          <tbody>
            {filteredDocuments.map((doc) => {
              const version = doc.current_version
              const link = doc.links?.find((l) => l.subject.type === subjectType && l.subject.id === subjectId)
              const fileType = getFileTypeBadge(version?.file_name, version?.mime_type)

              return (
                <tr key={doc.id} style={{ cursor: 'default' }}>
                  <td style={{ width: 1, whiteSpace: 'nowrap', paddingRight: 6 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }} title={fileType.label}>
                      {fileType.icon}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{doc.title}</span>
                      <span
                        className="chip subtle"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          ...fileType.style,
                        }}
                      >
                        {fileType.label}
                      </span>
                    </div>
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
                    <div className="row-actions" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {rowAction?.(doc)}
                      {version && (
                        <button
                          type="button"
                          className="btn secondary small-btn"
                          disabled={downloading === doc.id}
                          onClick={() => openOrDownload(doc)}
                        >
                          {fileType.isPreviewable ? 'View / Download' : 'Download'}
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
