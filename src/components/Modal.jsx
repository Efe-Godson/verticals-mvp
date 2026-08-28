// Place at: src/components/Modal.jsx
// The one shared modal. Every hand-rolled `position:fixed inset:0` overlay
// in the app funnels through here so they all: keep a gutter on phones,
// always cap height + scroll the body (header/footer stay reachable), and
// dock to the bottom as a drag-dismissable sheet below 600px.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import useIsMobile from '../hooks/useIsMobile'
import useDragToDismiss from './useDragToDismiss'

const SIZES = { sm: 380, md: 520, lg: 720, xl: 900, full: null }

export const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: '1rem',
}

export const modalCardStyle = {
  background: 'var(--color-surface)', borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)', width: 'min(520px, 100%)',
  maxHeight: 'min(88vh, 100%)', display: 'flex', flexDirection: 'column',
}

export default function Modal({
  open = true, onClose, title, children, footer,
  size = 'md', sheetOnMobile = true, closeLabel = 'Close',
  bodyStyle, cardStyle, hideHeader = false, bare = false,
}) {
  const isPhone = useIsMobile(600)
  const asSheet = isPhone && sheetOnMobile && size !== 'full'
  const { dragging, sheetRef, handleProps } = useDragToDismiss(onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null

  const px = SIZES[size]
  const card = {
    background: bare ? 'transparent' : 'var(--color-surface)',
    border: bare ? 'none' : '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    ...(asSheet
      ? {
          width: '100%', maxHeight: '92vh', borderRadius: '16px 16px 0 0',
          transform: 'translateY(0)', transition: dragging ? 'none' : 'transform 0.22s ease',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }
      : {
          width: size === 'full' ? 'min(96vw, 1100px)' : `min(${px}px, 100%)`,
          maxHeight: size === 'full' ? '94vh' : 'min(88vh, 100% - 2rem)',
          borderRadius: 'var(--radius)',
        }),
    ...cardStyle,
  }

  const overlay = {
    ...modalOverlayStyle,
    alignItems: asSheet ? 'flex-end' : 'center',
    padding: asSheet ? 0 : '1rem',
  }

  return createPortal(
    <div onClick={onClose} style={overlay}>
      <div ref={sheetRef} onClick={(e) => e.stopPropagation()} style={card} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        {asSheet && (
          <div {...handleProps} style={{ padding: '0.5rem 0 0.25rem', display: 'flex', justifyContent: 'center', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--color-border)' }} />
          </div>
        )}
        {!hideHeader && (title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: asSheet ? '0.4rem 1.1rem 0.8rem' : '1.1rem 1.3rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h3>
            {onClose && <button className="secondary" onClick={onClose} style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem', flexShrink: 0 }}>{closeLabel}</button>}
          </div>
        )}
        <div style={{ padding: bare ? 0 : '1.2rem 1.3rem', overflowY: 'auto', flex: 1, ...bodyStyle }}>
          {children}
        </div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.6rem', padding: '0.9rem 1.3rem', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
