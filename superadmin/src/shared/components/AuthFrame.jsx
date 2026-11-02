// The signed-out pages' frame: the story on the left, the form on the right.
const MODULES = ['Clients', 'Subscriptions', 'Quotas', 'Companies', 'Renewals']

export default function AuthFrame({ children }) {
  return (
    <div className="auth-split">
      <aside className="auth-story" aria-hidden="true">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-word">
            FBOS
            <small>Platform admin</small>
          </span>
        </div>
        <div>
          <p className="auth-headline">
            Every tenant, <em>one control room.</em>
          </p>
          <ul className="auth-modules">
            {MODULES.map((m, i) => (
              <li key={m} style={{ '--i': i }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-foot">
          <span>Platform administration</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </aside>
      <main className="auth-panel">{children}</main>
    </div>
  )
}
