// Place at: src/report/builder/print/elements/ImageElement.jsx
// Renders an image placed directly onto a Designer page (Designer 2.0
// Phase 1, step 8). Fit/opacity/radius/border are edited via
// FormatInspector's Image panel; this component owns only the upload
// interaction (there's no image yet) and the actual <img> rendering.
//
// Reuses uploadDesignerImage (src/lib/formImages.js), the same
// validate-then-supabase-storage-upload path as the form banner picker
// (BannerImagePicker.jsx), just under a `designer/` path instead of
// `banners/`. No interactive crop step for v1 - the element's own
// resizable box plus the `fit` (cover/contain) control covers most of
// what a basic crop would, and this avoids pulling react-easy-crop's UI
// into a context (an arbitrary-aspect-ratio box) it wasn't built for.
import { useRef, useState } from 'react'
import { useAuth } from '../../../../AuthContext'
import { uploadDesignerImage } from '../../../../lib/formImages'

export default function ImageElement({ element, editing, onChange }) {
  const { session } = useAuth()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const { src, fit = 'cover', opacity = 1, radius = 0 } = element

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const url = await uploadDesignerImage(file, session)
      onChange({ src: url })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (!src) {
    return (
      <div
        onClick={() => editing && inputRef.current?.click()}
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
          background: 'var(--color-surface-alt, #f3f4f6)', border: '1px dashed var(--color-border)',
          borderRadius: '8px', cursor: editing ? 'pointer' : 'default', color: 'var(--color-muted)', fontSize: '0.8rem',
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} data-html2canvas-ignore="true" style={{ display: 'none' }} />
        {uploading ? 'Uploading…' : editing ? '+ Add image' : ''}
        {error && <span style={{ color: '#b91c1c', fontSize: '0.72rem' }}>{error}</span>}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: radius }}>
      <img
        src={src} alt=""
        style={{ width: '100%', height: '100%', objectFit: fit, opacity, display: 'block' }}
      />
      {editing && (
        <button
          className="secondary" data-html2canvas-ignore="true" onClick={() => inputRef.current?.click()} title="Replace image"
          style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
        >
          Replace
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} data-html2canvas-ignore="true" style={{ display: 'none' }} />
    </div>
  )
}
