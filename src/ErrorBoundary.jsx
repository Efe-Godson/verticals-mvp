// Place at: src/ErrorBoundary.jsx
// The app had no error boundary - any render-time throw blanked the whole
// screen with nothing to go on. This catches it, shows the message + stack,
// and offers a reload. Wraps <Routes> in App.jsx.
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong on this page</h2>
          <p style={{ color: 'var(--color-muted)' }}>
            The rest of the app is fine — try reloading, or go back home.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '0.8rem', maxHeight: '40vh', overflow: 'auto',
          }}>
            {String(error?.stack || error?.message || error)}
          </pre>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()}>Reload</button>
            <button className="secondary" onClick={() => { window.location.href = '/' }}>Go home</button>
          </div>
        </div>
      </div>
    )
  }
}
