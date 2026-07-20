function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '380px', maxWidth: '100%' }}
      >
        <h3 style={{ margin: '0 0 0.7rem' }}>{title}</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0 0 1.3rem' }}>{message}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            style={danger ? { background: '#c0392b' } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog