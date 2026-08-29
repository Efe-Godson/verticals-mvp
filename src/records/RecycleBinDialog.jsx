import Modal from '../components/Modal'
import { SkeletonText } from '../components/Skeleton'

export function RecycleBinDialog({ form, submissions, loading, onRestore, onPermanentDelete, onEmptyBin, onClose }) {
  return (
    <Modal size="lg" onClose={onClose} title="Recycle Bin">
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 0, marginBottom: '1rem' }}>
        Deleted records stay here until restored or permanently erased.
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ padding: '0.8rem 1rem' }}><SkeletonText lines={2} /></div>)}
        </div>
      ) : submissions.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>The bin is empty.</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
            <button className="secondary" style={{ color: 'var(--status-critical)' }} onClick={onEmptyBin}>
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
                  padding: '0.6rem 0.8rem', border: '1px solid var(--color-border)', borderRadius: '6px'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{previewText}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                      Deleted {new Date(sub.deleted_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="secondary" onClick={() => onRestore(sub.id)}>Restore</button>
                    <button className="secondary" style={{ color: 'var(--status-critical)' }} onClick={() => onPermanentDelete(sub.id)}>
                      Delete Forever
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}
