// Place at: src/HomeRecycleBinDialog.jsx
// Recycle Bin for deleted forms, same pattern as the submissions bin in
// Records.jsx, simplified since a form only needs its name and delete date.
import Modal from './components/Modal'

function HomeRecycleBinDialog({ forms, loading, onRestore, onPermanentDelete, onEmptyBin, onClose }) {
  return (
    <Modal size="lg" onClose={onClose} title="Recycle Bin">
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 0, marginBottom: '1rem' }}>
        Deleted forms stay here until restored or permanently erased.
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : forms.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>The bin is empty.</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
            <button className="secondary" style={{ color: 'var(--status-critical)' }} onClick={onEmptyBin}>
              Empty Bin
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {forms.map(form => (
              <div key={form.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
                padding: '0.6rem 0.8rem', border: '1px solid var(--color-border)', borderRadius: '6px'
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{form.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                    Deleted {new Date(form.deleted_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="secondary" onClick={() => onRestore(form.id)}>Restore</button>
                  <button className="secondary" style={{ color: 'var(--status-critical)' }} onClick={() => onPermanentDelete(form.id)}>
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

export default HomeRecycleBinDialog
