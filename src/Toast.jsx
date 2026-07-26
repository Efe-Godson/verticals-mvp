// Place at: src/Toast.jsx
// App-wide toast notifications, replacing raw browser alert()s ("Link
// copied!", delete errors, etc.) with a small dismissible card stack that
// matches the rest of the UI instead of a native dialog.
import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

const TONE = {
  info: { border: 'var(--color-border)', icon: null },
  success: { border: 'var(--status-good)', icon: '✓' },
  error: { border: 'var(--status-critical)', icon: '!' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismissToast = useCallback((id) => {
    setToasts(current => current.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++nextId.current
    setToasts(current => [...current, { id, message, type }])
    if (duration) setTimeout(() => dismissToast(id), duration)
    return id
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '0.5rem',
        alignItems: 'center', pointerEvents: 'none'
      }}>
        {toasts.map(toast => {
          const tone = TONE[toast.type] || TONE.info
          return (
            <div
              key={toast.id}
              className="card"
              style={{
                pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.7rem 1rem', background: 'var(--color-surface)',
                borderLeft: `3px solid ${tone.border}`, fontSize: '0.88rem',
                boxShadow: '0 6px 18px rgba(0,0,0,0.18)', maxWidth: '420px',
                animation: 'toast-in 0.15s ease'
              }}
            >
              {tone.icon && <span style={{ color: tone.border, fontWeight: 700 }}>{tone.icon}</span>}
              <span style={{ flex: 1 }}>{toast.message}</span>
              <span
                onClick={() => dismissToast(toast.id)}
                style={{ cursor: 'pointer', color: 'var(--color-muted)', fontSize: '0.8rem', padding: '0 0.2rem' }}
              >
                ✕
              </span>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
