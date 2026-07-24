export function formatCell(value, field) {
  if (value === undefined || value === null || value === '') {
    return <span style={{ color: '#ccc' }}>—</span>
  }
  if (field.type === 'date') {
    const d = new Date(value)
    if (!isNaN(d)) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return value
  }
  if (field.type === 'number') {
    const num = Number(value)
    return isNaN(num) ? value : num.toLocaleString()
  }
  if (field.type === 'cart') {
    if (!value || !value.items || value.items.length === 0) {
      return <span style={{ color: '#ccc' }}>—</span>
    }
    return `${value.items.length} item${value.items.length !== 1 ? 's' : ''} — ₦${value.total.toLocaleString()}`
  }
  return value.toString()
}

export function FilterIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 3 21 3 14 12 14 20 10 22 10 12" />
    </svg>
  )
}

export function CubeIcon({ color = '#94a3b8' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 12v10" />
    </svg>
  )
}

export const overlayStyle = { position: 'fixed', inset: 0, zIndex: 15 }

export const dropdownStyle = {
  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
  background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '190px', padding: '0.6rem'
}

export function DropdownItem({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="secondary"
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        padding: '0.45rem 0.3rem', fontSize: '0.85rem', background: 'transparent'
      }}
    >
      {children}
    </button>
  )
}
