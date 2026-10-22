import { useEffect, useRef } from 'react'

// A modal on the native <dialog>: focus stays inside, Esc and the backdrop close it.
export default function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.open && dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="btn secondary small-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
