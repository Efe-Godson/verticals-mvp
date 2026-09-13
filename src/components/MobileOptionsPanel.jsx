// Place at: src/components/MobileOptionsPanel.jsx
// The mobile counterpart of Report.jsx/Records.jsx's desktop "Options ▾"
// dropdown - a partial-width slide-in-from-the-left drawer with the app's
// blue nav language (see PosSidePanel.jsx / NavBar.jsx's mobile menu)
// instead of a small floating box pinned under the trigger button, plus a
// back arrow at the top right (PosSidePanel's own "close" convention) rather
// than a plain ✕. Redefining the theme's --color-* tokens on the panel root
// - not hand-recoloring every button/checkbox/label inside optionsMenuItems
// - is what lets the exact same menu content (Print/export buttons, Records'
// Columns checkboxes, Presets list, etc.) already built for a light surface
// read correctly on this blue one, since all of that content is styled via
// var(--color-text)/var(--color-muted)/var(--color-border)/var(--color-surface)
// rather than literal colors. Covering the full screen read as leaving the
// page entirely rather than a panel over it - a partial drawer with the
// backdrop still visible at the edge keeps "you're still on this page".
import { createPortal } from 'react-dom'
import ArrowLeftIcon from '../ArrowLeftIcon'

export default function MobileOptionsPanel({ open, onClose, title = 'Options', className = '', children }) {
  if (!open) return null
  return createPortal(
    <div className={className}>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }}
      />
      <div
        className="pos-style-options-panel"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
          width: 'min(82vw, 340px)',
          background: 'var(--color-primary)', color: 'white',
          display: 'flex', flexDirection: 'column', fontSize: '0.9rem',
          boxShadow: '2px 0 12px rgba(0,0,0,0.2)',
          '--color-text': '#ffffff',
          '--color-muted': 'rgba(255, 255, 255, 0.65)',
          '--color-border': 'rgba(255, 255, 255, 0.25)',
          '--color-surface': 'transparent',
          '--color-bg': 'rgba(255, 255, 255, 0.1)',
        }}
      >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        padding: 'calc(0.9rem + env(safe-area-inset-top)) 1rem 0.9rem',
      }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close options"
          style={{
            width: '44px', height: '44px', marginRight: '-0.5rem', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0,
          }}
        >
          <ArrowLeftIcon size={22} />
        </button>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 1rem calc(1.25rem + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      </div>
    </div>,
    document.body
  )
}
