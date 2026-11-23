import { useState } from 'react'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Opens a PDF the server makes (a proposal or quotation) in a new tab. The tab opens on the
// click itself, so the browser doesn't block it, and shows the file once it has arrived.
export default function PdfButton({ label = 'View PDF', load, className = 'btn secondary small-btn' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function open() {
    setError(null)
    setBusy(true)
    const tab = window.open('', '_blank')
    try {
      const url = URL.createObjectURL(await load())
      if (tab) tab.location.href = url
      else window.location.assign(url)
      // The tab has its copy by then.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      tab?.close()
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open} disabled={busy} aria-busy={busy}>
        {busy ? 'Opening…' : label}
      </button>
      {error && <ErrorBanner error={error} />}
    </>
  )
}
