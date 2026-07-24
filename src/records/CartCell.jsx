import { overlayStyle, dropdownStyle } from './recordsUiKit'

export function CartCell({ value, cellKey, openCartCellKey, setOpenCartCellKey }) {
  if (!value || !value.items || value.items.length === 0) {
    return <span style={{ color: '#ccc' }}>—</span>
  }

  const isOpen = openCartCellKey === cellKey

  return (
    <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <span
        onClick={() => setOpenCartCellKey(isOpen ? null : cellKey)}
        style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted' }}
      >
        {value.items.length} item{value.items.length !== 1 ? 's' : ''} — ₦{value.total.toLocaleString()}
      </span>

      {isOpen && (
        <>
          <div style={overlayStyle} onClick={() => setOpenCartCellKey(null)} />
          <div className="dropdown-panel" style={{ ...dropdownStyle, right: 'auto', left: 0, minWidth: '260px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
              Order Details
            </div>
            {value.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: '0.6rem',
                fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <span>{item.name} <span style={{ color: '#999' }}>× {item.quantity}</span></span>
                <span style={{ whiteSpace: 'nowrap' }}>₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span>Total</span>
              <span>₦{value.total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </span>
  )
}
