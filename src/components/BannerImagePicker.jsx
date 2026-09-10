// The form builder's "Header image" card - one fixed banner shape any
// picture crops to fill (so every form's header reads the same), with a
// solid brand-colour bar flush underneath. Shared by CreateForm and
// EditForm. Upload plumbing lives in lib/formImages.js (uploadBannerImage);
// this is just the control - the preview mirrors PublicForm's .pf-banner.

const SHAPE = { width: '100%', aspectRatio: '4 / 1', objectFit: 'fill', display: 'block' }

export default function BannerImagePicker({ value, uploading, error, onPick, onClear }) {
  function handleInput(e) {
    const file = e.target.files[0]
    if (file) onPick(file)
    e.target.value = '' // let the same file be re-picked after a remove
  }

  return (
    <div className="card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.5rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.92rem' }}>Header image</label>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0.2rem 0 0.7rem' }}>
        Any picture is stretched to fill a fixed banner shape above the form title - nothing cropped, no empty edges. Optional, up to 5MB.
      </p>

      {value ? (
        <div>
          <div style={{ borderRadius: 'var(--radius) var(--radius) 0 0', overflow: 'hidden' }}>
            <img src={value} alt="" style={{ ...SHAPE, background: 'var(--color-surface)' }} />
            <div style={{ height: 6, background: 'var(--color-primary)' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
            <label className="secondary" style={pickBtnStyle}>
              {uploading ? 'Uploading...' : 'Replace'}
              <input type="file" accept="image/*" disabled={uploading} onChange={handleInput} style={{ display: 'none' }} />
            </label>
            <button type="button" className="secondary" onClick={onClear} style={{ fontSize: '0.85rem' }}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          style={{
            ...SHAPE, cursor: uploading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)',
            color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center',
          }}
        >
          {uploading ? 'Uploading...' : '+ Upload header image'}
          <input type="file" accept="image/*" disabled={uploading} onChange={handleInput} style={{ display: 'none' }} />
        </label>
      )}

      {error && <p style={{ color: '#c0392b', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}

// A <label> can't inherit button.secondary's styling on its own, so spell
// out the same border/padding/radius here.
const pickBtnStyle = {
  display: 'inline-block',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '0.4rem 0.9rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
}
