// Small non-blocking loading cues (Universal Loading States brief §3C, §10).
import { LoadingSpinner } from '../LoadingState'

// A quiet spinner + label for a section that's loading in place (a panel, a
// list inside a card) - not a whole page.
export function InlineLoader({ label = 'Loading…', style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-muted)', fontSize: '0.85rem', ...style }}>
      <LoadingSpinner size={15} color="var(--color-primary)" />
      {label}
    </span>
  )
}

// Background-refresh indicator: existing content stays put, this sits next
// to the page/section heading while newer data is fetched (§3C). Render it
// only when refreshing AND there is already content on screen.
export function RefreshingIndicator({ show, label = 'Updating…', style }) {
  if (!show) return null
  return (
    <span
      role="status"
      aria-live="polite"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted)', fontSize: '0.78rem', fontWeight: 500, ...style }}
    >
      <LoadingSpinner size={13} color="var(--color-primary)" />
      {label}
    </span>
  )
}
