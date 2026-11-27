import { Component } from 'react'

// Keeps one page's crash from blanking the whole console: the sidebar and top bar stay, and the person
// is told this page hit a problem with a way to try again. It is reset by giving it a new `key`
// (the layout keys it by path, so moving to another page clears it).
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // Left in the browser console for whoever supports the console; nothing is sent anywhere.
    console.error('A page failed to draw:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="panel" role="alert" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>This page hit a problem</h2>
        <p className="muted">
          Something on this page could not be shown. The rest of FBOS still works: pick another page from the menu, or try this one again.
        </p>
        <div className="row-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => this.setState({ failed: false })}>Try again</button>
          <button type="button" className="btn secondary" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      </div>
    )
  }
}
