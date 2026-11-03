import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { flowFor } from '@/app/navigation.jsx'
import { preloadPage } from '@/app/pages.js'

const HIDDEN_KEY = 'fbos_intro_hidden'
// Told whenever the folded intros change, so every user of usePageIntros reads them again.
const CHANGED = 'fbos-intros-changed'

function readHidden() {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

function writeHidden(set) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]))
  } catch {
    // Not remembered across visits; hiding still works for now.
  }
  window.dispatchEvent(new Event(CHANGED))
}

// Which pages' intros are folded away: per page, or '*' for all of them.
export function usePageIntros() {
  const [hidden, setHidden] = useState(readHidden)
  useEffect(() => {
    const reread = () => setHidden(readHidden())
    window.addEventListener(CHANGED, reread)
    return () => window.removeEventListener(CHANGED, reread)
  }, [])
  const update = useCallback((change) => {
    const next = readHidden()
    change(next)
    writeHidden(next)
  }, [])
  return {
    isHidden: (path) => hidden.has('*') || hidden.has(path),
    hide: (path) => update((s) => s.add(path)),
    hideAll: () => update((s) => s.add('*')),
    show: (path) => update((s) => {
      s.delete(path)
      s.delete('*')
    }),
    showAll: () => update((s) => s.clear()),
    anyHidden: hidden.size > 0,
  }
}

// The flow the page is a step of, as steps one can open. Steps the person may not open are shown,
// so the whole flow makes sense, but not as links.
export function FlowSteps({ flow, current, canOpen, compact = false }) {
  return (
    <ol className={`flow-steps${compact ? ' compact' : ''}`} aria-label={flow.label}>
      {flow.steps.map((step, i) => {
        const here = step.to === current
        const open = canOpen(step.to)
        const body = (
          <>
            <span className="flow-step-no" aria-hidden="true">{i + 1}</span>
            <span className="flow-step-text">
              <strong>{step.label}</strong>
              {!compact && <small>{step.hint}</small>}
            </span>
          </>
        )
        return (
          <li key={step.to} className={`flow-step${here ? ' here' : ''}${open ? '' : ' locked'}`} aria-current={here ? 'step' : undefined}>
            {open && !here ? (
              <Link to={step.to} onMouseEnter={() => preloadPage(step.to)} title={step.hint}>
                {body}
              </Link>
            ) : (
              <span title={open ? step.hint : `${step.hint} — you don't have access to this page`}>{body}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// The strip under the top bar of a section's page: what the page is for, and where it sits in
// its flow. Folded away per page (or everywhere) once someone knows their way around.
export default function PageIntro({ item, section, canOpen, intros }) {
  if (!item?.description) return null
  const flow = flowFor(item.to)
  if (intros.isHidden(item.to)) return null
  return (
    <section className="page-intro" aria-label="About this page">
      <div className="page-intro-text">
        <div className="page-intro-eyebrow">
          {section?.label}
          {section?.hint && <span> · {section.hint}</span>}
        </div>
        <p>{item.description}</p>
      </div>
      <div className="page-intro-actions">
        <Link to="/guide" className="page-intro-link">How it all fits</Link>
        <button type="button" className="page-intro-close" onClick={() => intros.hide(item.to)} title="Hide this tip" aria-label="Hide this tip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {flow && (
        <div className="page-intro-flow">
          <div className="page-intro-flow-label">{flow.label}</div>
          <FlowSteps flow={flow} current={item.to} canOpen={canOpen} />
        </div>
      )}
    </section>
  )
}
