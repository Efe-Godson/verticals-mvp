export function RecycleBinDialog({ form, submissions, loading, onRestore, onPermanentDelete, onEmptyBin, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '8px', padding: '1.5rem',
          width: '560px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0 }}>Recycle Bin</h3>
          <button onClick={onClose} className="secondary">Close</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem', marginBottom: '1rem' }}>
          Deleted records stay here until restored or permanently erased.
        </p>

        {loading ? (
          <p style={{ color: '#999' }}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p style={{ color: '#999' }}>The bin is empty.</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
              <button className="secondary" style={{ color: '#c0392b' }} onClick={onEmptyBin}>
                Empty Bin
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {submissions.map(sub => {
                const previewField = form.fields.find(f => {
                  const val = sub.data[f.id]
                  return f.type !== 'cart' && val !== undefined && val !== null && val.toString().trim() !== ''
                })
                const previewText = previewField ? sub.data[previewField.id].toString() : `Record ${sub.id.slice(0, 8)}`

                return (
                  <div key={sub.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', border: '1px solid #eee', borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{previewText}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.15rem' }}>
                        Deleted {new Date(sub.deleted_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" onClick={() => onRestore(sub.id)}>Restore</button>
                      <button className="secondary" style={{ color: '#c0392b' }} onClick={() => onPermanentDelete(sub.id)}>
                        Delete Forever
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
