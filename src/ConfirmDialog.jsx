import Modal from './components/Modal'

// Thin wrapper over the shared <Modal>. Kept as its own component because
// ~15 call sites import ConfirmDialog by name.
function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }) {
  return (
    <Modal
      size="sm"
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="secondary" onClick={onCancel}>{cancelLabel}</button>
          <button onClick={onConfirm} style={danger ? { background: 'var(--status-critical)' } : undefined}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: 0 }}>{message}</p>
    </Modal>
  )
}

export default ConfirmDialog
