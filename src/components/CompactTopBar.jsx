// A minimal top bar for the desktop side-panel flows (PosSidePanel /
// PayrollSidePanel). It stays visible whether the panel is docked or
// collapsed, so the layout reads as one consistent header.
//
//   [ ☰ ]  Title .....................................  ( ← )
//
// - Height is driven by its content (responsive padding via clamp()), not a
//   fixed value. It publishes its measured height as --compact-topbar-h so
//   index.css can reserve exactly that much space (body.compact-topbar).
// - Content is capped to the same max-width as the page and centred, so the
//   controls line up with the content below rather than the browser edges.
// - `onMenu` given  -> show the themed hamburger (panel collapsed; tap to
//   expand). Omit it when docked - the panel is right there.
// - `leftOffset`    -> px the bar starts from the left (the docked panel's
//   width) so it doesn't run under the panel.
import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ArrowLeftIcon from '../ArrowLeftIcon'

// Responsive button box - small on a narrow window, a touch larger on a wide
// one; never a single rigid size.
const BTN = 'clamp(34px, 5vw, 38px)'

export default function CompactTopBar({
  title, onMenu, exitLink, leftOffset = 0,
  // Match the content column of the page below so the controls line up with
  // it instead of the browser edges.
  contentMax = 'min(1600px, 100%)',
  padX = 'clamp(1rem, 4vw, 4.5rem)',
}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--compact-topbar-h', `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--compact-topbar-h')
    }
  }, [])

  return (
    <header
      ref={ref}
      style={{
        position: 'fixed', top: 0, left: leftOffset, right: 0, zIndex: 150,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: contentMax, margin: '0 auto',
          paddingTop: 'clamp(5px, 0.9vw, 9px)', paddingBottom: 'clamp(5px, 0.9vw, 9px)',
          paddingLeft: padX, paddingRight: padX,
          display: 'flex', alignItems: 'center', gap: 'clamp(8px, 1.6vw, 14px)',
        }}
      >
        {onMenu && (
          <button
            type="button" onClick={onMenu} aria-label="Open menu"
            style={{
              flexShrink: 0, width: BTN, height: BTN, padding: 0, borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3.5,
            }}
          >
            <span style={{ width: '45%', height: 2, background: 'white', borderRadius: 1 }} />
            <span style={{ width: '45%', height: 2, background: 'white', borderRadius: 1 }} />
            <span style={{ width: '45%', height: 2, background: 'white', borderRadius: 1 }} />
          </button>
        )}

        {title && (
          <span style={{
            fontWeight: 600, fontSize: 'clamp(0.9rem, 1.6vw, 1.05rem)', color: 'var(--color-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          }}>
            {title}
          </span>
        )}

        {exitLink && (
          <Link
            to={exitLink.to}
            aria-label={`Back to ${exitLink.label}`}
            title={exitLink.label}
            style={{
              flexShrink: 0, marginLeft: 'auto',
              width: BTN, height: BTN, borderRadius: '50%',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)', color: 'var(--color-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowLeftIcon size={16} />
          </Link>
        )}
      </div>
    </header>
  )
}
