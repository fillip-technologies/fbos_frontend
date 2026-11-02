import fillipLogoWhite from '@/assets/brand/fillip-logo-white.png'

// The signed-out pages' frame: the story on the left, the form on the right.
const MODULES = ['Sales', 'Billing & tax', 'Delivery', 'People', 'Assets', 'Planning', 'Inventory']

export default function AuthFrame({ children }) {
  return (
    <div className="auth-split">
      <aside className="auth-story" aria-hidden="true">
        <img className="auth-logo" src={fillipLogoWhite} alt="Fillip Technologies" />
        <div>
          <p className="auth-product">FBOS · Business operating system</p>
          <p className="auth-headline">
            The whole business, <em>in one ledger.</em>
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
          <span>© {new Date().getFullYear()}</span>
        </div>
      </aside>
      <main className="auth-panel">{children}</main>
    </div>
  )
}
