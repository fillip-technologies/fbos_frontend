import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { preloadPage } from '@/app/pages.js'
import useRecordSearch from '@/features/search/useRecordSearch.js'

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

const ICON_RECORD = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
)

const ICON_NEW = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

// Every word of the query starts a word of the text (plain words, any order): for descriptions,
// where a fuzzy match would find nonsense.
function wordMatch(text, query) {
  if (!text) return false
  const words = text.toLowerCase().split(/[^a-z0-9]+/)
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((q) => words.some((w) => w.startsWith(q)))
}

// sections: navSections(...) output; extras: [{ id, label, hint, icon, run }] actions;
// createActions: CREATE_ACTIONS the person may do ({ to, label, hint }).
export default function CommandPalette({ sections, extras, createActions = [], onClose }) {
  const ref = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  // Records anywhere in FBOS (customers, deals, projects, people, ...), alongside pages.
  const records = useRecordSearch(query)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.open && dialog.close()
  }, [])

  const entries = useMemo(() => {
    const pages = sections.flatMap((s) =>
      s.items.map((item) => ({
        id: `page:${item.to}`, label: item.label, hint: s.label, section: s.id, description: item.description, icon: item.icon, to: item.to,
      })),
    )
    const creates = createActions.map((x) => ({ ...x, id: `new:${x.to}`, label: `New ${x.label.toLowerCase()}`, description: x.hint, hint: 'Create', icon: ICON_NEW }))
    const actions = extras.map((x) => ({ ...x, id: `action:${x.id}` }))
    const q = query.trim()
    if (!q) {
      const recent = readRecent()
        .map((to) => pages.find((p) => p.to === to))
        .filter(Boolean)
      const groups = []
      if (recent.length) groups.push({ label: 'Recent', items: recent })
      for (const s of sections) groups.push({ label: s.label, items: pages.filter((p) => p.section === s.id) })
      if (creates.length) groups.push({ label: 'Create', items: creates })
      groups.push({ label: 'Account', items: actions })
      return groups
    }
    // Names first, then the section, then what the page is for: "salary" finds Payroll.
    const ranked = [...pages, ...creates, ...actions]
      .map((e) => ({
        e,
        s: Math.max(score(e.label, q) ?? -1, (score(`${e.hint} ${e.label}`, q) ?? -1) - 20, wordMatch(e.description, q) ? 10 : -1),
      }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((r) => r.e)
    const found = records.groups.map((g) => ({ ...g, items: g.items.map((item) => ({ ...item, icon: ICON_RECORD })) }))
    return [...(ranked.length ? [{ label: 'Pages and actions', items: ranked }] : []), ...found]
  }, [sections, extras, createActions, query, records.groups])

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
      aria-label="Search FBOS"
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
          placeholder="Search pages, customers, invoices, projects, people…"
          aria-label="Search FBOS"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-activedescendant={active ? `cmdk-${active.id}` : undefined}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
        {flat.length === 0 && !records.searching && <p className="cmdk-empty">Nothing matches “{query}”.</p>}
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
                    <span className="cmdk-label">
                      {item.label}
                      {item.description && <small>{item.description}</small>}
                    </span>
                    {item.hint && <span className="cmdk-hint">{item.hint}</span>}
                    <span className="cmdk-enter" aria-hidden="true">↵</span>
                  </div>
                )
              })}
            </div>
          ) : null,
        )}
      </div>
      {records.searching && (
        <p className="cmdk-searching" role="status">
          Searching customers, sales, projects, people…
        </p>
      )}
      <div className="cmdk-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>{shortcutLabel}</kbd> toggle</span>
      </div>
    </dialog>
  )
}
