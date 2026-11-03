import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { preloadPage } from '@/app/pages.js'

// A create form's code is preloaded with its list's.
const listOf = (to) => to.replace(/\/new$/, '')

// The top bar's "New" button: start any record the person may create, from any page.
// A disclosure (button + list of links), not an ARIA menu: Tab moves through it, Esc closes it.
export default function NewMenu({ actions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const listId = useId()
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!actions.length) return null
  return (
    <div className="new-menu" ref={ref}>
      <button
        type="button"
        className="btn small-btn new-menu-btn"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => actions.slice(0, 4).forEach((a) => preloadPage(listOf(a.to)))}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New
      </button>
      {open && (
        <div className="new-menu-pop" id={listId}>
          <div className="new-menu-head">Start something new</div>
          <ul>
            {actions.map((a) => (
              <li key={a.to}>
                <Link to={a.to} onMouseEnter={() => preloadPage(listOf(a.to))} onClick={() => setOpen(false)}>
                  <strong>{a.label}</strong>
                  <small>{a.hint}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
