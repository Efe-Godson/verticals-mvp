// The form builder's "Header image" card. Pick a picture, then crop /
// reposition it to the fixed 4:1 banner shape before it's saved (so the
// same shape ends up on every form, but the creator controls what's in
// frame). Upload plumbing lives in lib/formImages.js (uploadBannerImage);
// the preview mirrors PublicForm's .pf-banner.
import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import Modal from './Modal'
import { getCroppedBlob } from '../lib/cropImage'

const SHAPE = { width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', objectPosition: 'center', display: 'block' }
const ASPECT = 4 / 1

export default function BannerImagePicker({ value, uploading, error, onPick, onClear }) {
  const [cropSrc, setCropSrc] = useState(null) // data URL of the just-picked file, while the cropper is open
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const onCropComplete = useCallback((_area, pixels) => setAreaPixels(pixels), [])

  function handleInput(e) {
    const file = e.target.files[0]
    e.target.value = '' // let the same file be re-picked later
    if (!file) return
    setLocalError('')
    if (!file.type.startsWith('image/')) { setLocalError('Please choose an image file.'); return }
    if (file.size > 15 * 1024 * 1024) { setLocalError('That image is too large - pick one under 15MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setAreaPixels(null); setCropSrc(reader.result) }
    reader.onerror = () => setLocalError('Could not read that file.')
    reader.readAsDataURL(file)
  }

  async function confirmCrop() {
    if (!cropSrc || !areaPixels) return
    setBusy(true)
    setLocalError('')
    try {
      const blob = await getCroppedBlob(cropSrc, areaPixels)
      setCropSrc(null)
      onPick(blob) // parent uploads it and sets value
    } catch (err) {
      setLocalError(err.message || 'Could not crop that image.')
    } finally {
      setBusy(false)
    }
  }

  const shownError = error || localError

  return (
    <div className="card" style={{ padding: '1.2rem 1.4rem', marginBottom: '1.5rem' }}>
      <label style={{ fontWeight: 600, fontSize: '0.92rem' }}>Header image</label>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0.2rem 0 0.7rem' }}>
        Sits in a fixed banner shape above the form title. Pick a picture and crop it to fit. Optional.
      </p>

      {value ? (
        <div>
          <div style={{ borderRadius: 'var(--radius) var(--radius) 0 0', overflow: 'hidden' }}>
            <img src={value} alt="" style={SHAPE} />
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

      {shownError && <p style={{ color: '#c0392b', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: 0 }}>{shownError}</p>}

      {cropSrc && (
        <Modal
          size="lg"
          onClose={() => !busy && setCropSrc(null)}
          title="Position the banner"
          footer={
            <>
              <button type="button" className="secondary" disabled={busy} onClick={() => setCropSrc(null)}>Cancel</button>
              <button type="button" disabled={busy || !areaPixels} onClick={confirmCrop}>
                {busy ? 'Saving...' : 'Use image'}
              </button>
            </>
          }
        >
          <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
            Drag to move, use the slider to zoom. What&apos;s inside the frame is what shows on the form.
          </p>
          <div style={{ position: 'relative', width: '100%', height: 240, background: '#111', borderRadius: 8, overflow: 'hidden' }}>
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.9rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Zoom</span>
            <input
              type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </Modal>
      )}
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
