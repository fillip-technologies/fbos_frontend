import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CREATE_ACTIONS, FLOWS, NAV_ITEMS, navSections } from '@/app/navigation.jsx'
import { FlowSteps, usePageIntros } from '@/app/layout/PageIntro.jsx'
import { shortcutLabel } from '@/app/layout/CommandPalette.jsx'
import { preloadPage } from '@/app/pages.js'
import { hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

// What each flow is, said once in plain words.
const FLOW_STORIES = {
  'lead-to-cash':
    'Every sale follows the same road. An enquiry becomes an opportunity you quote for; a signed contract starts the project and its billing schedule; each payment term becomes an invoice; payments settle the invoices. Every record links to the ones before and after it, so you can follow a sale from any point.',
  'hire-to-exit':
    'From the day a job is posted to the day someone leaves: hiring, their employee record and sign-in, attendance and leave, pay, promotions and transfers, and finally offboarding. Access to FBOS follows the person’s job, so a promotion changes what they can open.',
  'plan-to-review':
    'Set the year and its goals, give each unit a budget, check people are free to do the work, then review KPIs against their targets each quarter.',
  'buy-to-retire':
    'Equipment is ordered from a vendor and received into stock, installed at a site, reported when it breaks, repaired, and finally scrapped or sold.',
}

const TIPS = [
  { key: 'search', title: 'Find anything', body: `Press / or ${shortcutLabel} on any page and type what you want to do: “invoice”, “leave”, “salary”.` },
  { key: 'new', title: 'Start from anywhere', body: 'The New button in the top bar creates a lead, task, invoice and more without hunting for the right page.' },
  { key: 'journey', title: 'Follow a record', body: 'A lead, opportunity, contract or invoice shows its whole journey at the top: what came before, what is next, and the button to do it.' },
  { key: 'tips', title: 'Page tips', body: 'Each section page starts with a short note on what it is for. Close it with × once you know your way around.' },
]

// "/guide": how FBOS fits together — the flows, every area the person may open and what it is
// for, and how to get around.
export default function Guide() {
  const { user } = useAuth()
  const intros = usePageIntros()
  const items = useMemo(() => NAV_ITEMS.filter((item) => hasAccess(user, item.access)), [user])
  const sections = useMemo(() => navSections(items.filter((i) => i.to !== '/guide')), [items])
  const canOpen = (to) => items.some((i) => i.to === to)
  // Flows the person takes part in: at least two of the steps are theirs to open.
  const flows = FLOWS.filter((flow) => flow.steps.filter((s) => canOpen(s.to)).length >= 2)
  const creates = CREATE_ACTIONS.filter((a) => hasAccess(user, a.access))

  return (
    <div className="guide">
      <header className="guide-hero">
        <div className="home-eyebrow">Getting started</div>
        <h1 className="home-title">How FBOS works</h1>
        <p className="home-sub">
          FBOS runs the whole business in one place: selling, delivering the work, billing and getting paid, your people,
          and your plans. The parts are connected, so information entered once follows the work from step to step.
        </p>
      </header>

      {flows.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h2>The main journeys</h2>
            <span>Click a step to open it</span>
          </div>
          <div className="guide-flows">
            {flows.map((flow) => (
              <article key={flow.id} className="panel guide-flow">
                <h3>{flow.label}</h3>
                <p className="muted">{FLOW_STORIES[flow.id]}</p>
                <FlowSteps flow={flow} current={null} canOpen={canOpen} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="home-section-head">
          <h2>What each area is for</h2>
          <span>Only the pages you can open are listed; ask your administrator for more</span>
        </div>
        <div className="guide-areas">
          {sections.map((section) => (
            <article key={section.id} className="panel guide-area">
              <h3>{section.label}</h3>
              {section.hint && <p className="guide-area-hint">{section.hint}</p>}
              <ul>
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} onMouseEnter={() => preloadPage(item.to)}>
                      <span className="place-icon">{item.icon}</span>
                      <span>
                        <strong>{item.label}</strong>
                        {item.description && <small>{item.description}</small>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Getting around</h2>
        </div>
        <div className="guide-tips">
          {TIPS.filter((t) => t.key !== 'new' || creates.length > 0).map((tip) => (
            <div key={tip.key} className="panel guide-tip">
              <h3>{tip.title}</h3>
              <p className="muted">{tip.body}</p>
              {tip.key === 'tips' && intros.anyHidden && (
                <button type="button" className="btn secondary small-btn" onClick={intros.showAll}>
                  Show page tips again
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
