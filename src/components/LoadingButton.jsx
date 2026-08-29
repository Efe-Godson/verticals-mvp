// Button that owns its own loading state (Universal Loading States brief
// §3B). Only the button that triggered the action changes; it's disabled
// while busy (no double-submit) and keeps its exact width - the resting
// label stays in the DOM for sizing and the spinner overlays it.
//
//   <LoadingButton loading={saving} loadingLabel="Saving…" onClick={save}>
//     Save Employee
//   </LoadingButton>
import { LoadingSpinner } from '../LoadingState'

export default function LoadingButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  className,
  style,
  ...rest
}) {
  return (
    <button
      {...rest}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ position: 'relative', ...style }}
    >
      {/* resting label - kept for width, hidden while busy */}
      <span style={{ visibility: loading ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        {children}
      </span>
      {loading && (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '0.45rem', whiteSpace: 'nowrap',
        }}>
          <LoadingSpinner size={16} />
          {loadingLabel && <span style={{ fontSize: '0.9em' }}>{loadingLabel}</span>}
        </span>
      )}
    </button>
  )
}
