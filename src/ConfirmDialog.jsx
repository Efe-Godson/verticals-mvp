function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 300
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ padding: '1.5rem', width: '360px', maxWidth: '90vw' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: 0 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.4rem' }}>
          <button className="secondary" onClick={onCancel}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={danger ? { background: '#c0392b' } : {}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
