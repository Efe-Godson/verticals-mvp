// The form builder's "Header image" card - a compact logo/banner strip
// shown above the form title on the public form, with the form's brand
// colour as its bottom border. Shared by CreateForm and EditForm. Upload
// plumbing lives in lib/formImages.js (uploadBannerImage); this is just
// the control - the preview mirrors how PublicForm renders it (.pf-banner).

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
        A small logo or banner strip above the form title. Its height follows the image. Optional, up to 5MB.
      </p>

      {value ? (
        <div>
          <div style={{ borderBottom: '3px solid var(--color-primary)', paddingBottom: '10px' }}>
            <img
              src={value}
              alt=""
              style={{ display: 'block', width: '100%', maxHeight: 104, objectFit: 'contain', objectPosition: 'center' }}
            />
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
        <label className="secondary" style={pickBtnStyle}>
          {uploading ? 'Uploading...' : 'Upload image'}
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
