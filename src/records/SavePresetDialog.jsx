import { useState } from 'react'

export function SavePresetDialog({ onSave, onClose }) {
  const [name, setName] = useState('')

  function handleSave() {
    if (name.trim() === '') return
    onSave(name.trim())
  }

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
        style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '360px', maxWidth: '100%' }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>Save Filter Preset</h3>

        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Preset name</label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          placeholder="e.g. This week's orders"
          style={{ padding: '0.5rem', width: '100%', marginTop: '0.4rem', marginBottom: '1.2rem' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={name.trim() === ''}>Save</button>
        </div>
      </div>
    </div>
  )
}
