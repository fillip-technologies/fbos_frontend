import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// A modal form: title, optional intro, the failure from the last submit, and Cancel / Save.
// `wide` gives two-column forms room; fields go in as children (see Field).
export default function FormDialog({
  title,
  intro,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  savingLabel = 'Saving...',
  saving = false,
  error = null,
  wide = false,
  children,
}) {
  return (
    <Dialog title={title} onClose={onClose} wide={wide}>
      {intro && <p className="dialog-intro">{intro}</p>}
      <form onSubmit={onSubmit}>
        <ErrorBanner error={error} />
        {children}
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? savingLabel : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
