import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { preloadPage } from '@/app/pages.js'

const RECENT_KEY = 'fbos_recent_pages'
const RECENT_MAX = 5

export function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

// Remembers the nav pages a person opens, newest first, for the palette's "Recent" group.
export function rememberPage(to) {
  if (!to) return
  try {
    const next = [to, ...readRecent().filter((p) => p !== to)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: recents are a nicety, nothing to do.
  }
}

// Subsequence match with a bonus for word starts and runs; null when the query doesn't match.
function score(text, query) {
  if (!query) return 0
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  const direct = t.indexOf(q)
  if (direct !== -1) return 100 - direct + (direct === 0 || t[direct - 1] === ' ' ? 50 : 0)
  let total = 0
  let ti = 0
  let run = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    run = found === ti ? run + 1 : 0
    total += 1 + run * 2 + (found === 0 || t[found - 1] === ' ' ? 4 : 0)
    ti = found + 1
  }
  return total
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

// Opens on ⌘K / Ctrl+K anywhere, or "/" when not typing in a field.
export function usePaletteShortcut(setOpen) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      if (typing || document.querySelector('dialog[open]')) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
}

// sections: navSections(...) output; extras: [{ id, label, hint, icon, run }] actions.
export default function CommandPalette({ sections, extras, onClose }) {
  const ref = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.open && dialog.close()
  }, [])

  const entries = useMemo(() => {
    const pages = sections.flatMap((s) =>
      s.items.map((item) => ({ id: `page:${item.to}`, label: item.label, hint: s.label, icon: item.icon, to: item.to })),
    )
    const actions = extras.map((x) => ({ ...x, id: `action:${x.id}` }))
    const q = query.trim()
    if (!q) {
      const recent = readRecent()
        .map((to) => pages.find((p) => p.to === to))
        .filter(Boolean)
      const groups = []
      if (recent.length) groups.push({ label: 'Recent', items: recent })
      for (const s of sections) groups.push({ label: s.label, items: pages.filter((p) => p.hint === s.label) })
      groups.push({ label: 'Account', items: actions })
      return groups
    }
    const ranked = [...pages, ...actions]
      .map((e) => ({ e, s: Math.max(score(e.label, q) ?? -1, (score(`${e.hint} ${e.label}`, q) ?? -1) - 20) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((r) => r.e)
    return ranked.length ? [{ label: 'Best matches', items: ranked }] : []
  }, [sections, extras, query])

  const flat = useMemo(() => entries.flatMap((g) => g.items), [entries])
  const active = flat[Math.min(cursor, flat.length - 1)]

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    if (active?.to) preloadPage(active.to)
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(entry) {
    if (!entry) return
    onClose()
    if (entry.to) navigate(entry.to)
    else entry.run?.()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  let index = -1
  return (
    <dialog
      ref={ref}
      className="cmdk"
      aria-label="Jump to a page"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="cmdk-input">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a page or action…"
          aria-label="Search pages"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-activedescendant={active ? `cmdk-${active.id}` : undefined}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
        {flat.length === 0 && <p className="cmdk-empty">Nothing matches “{query}”.</p>}
        {entries.map((g) =>
          g.items.length ? (
            <div key={g.label} className="cmdk-group" role="group" aria-label={g.label}>
              <div className="cmdk-group-label">{g.label}</div>
              {g.items.map((item) => {
                index += 1
                const i = index
                const isActive = item === active
                return (
                  <div
                    key={`${g.label}-${item.id}`}
                    id={isActive ? `cmdk-${item.id}` : undefined}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    className="cmdk-item"
                    onMouseMove={() => cursor !== i && setCursor(i)}
                    onClick={() => choose(item)}
                  >
                    <span className="cmdk-icon">{item.icon}</span>
                    <span className="cmdk-label">{item.label}</span>
                    {item.hint && <span className="cmdk-hint">{item.hint}</span>}
                    <span className="cmdk-enter" aria-hidden="true">↵</span>
                  </div>
                )
              })}
            </div>
          ) : null,
        )}
      </div>
      <div className="cmdk-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>{shortcutLabel}</kbd> toggle</span>
      </div>
    </dialog>
  )
}
