import { useState } from 'react'
import Modal from '../components/Modal'

export function SavePresetDialog({ onSave, onClose }) {
  const [name, setName] = useState('')

  function handleSave() {
    if (name.trim() === '') return
    onSave(name.trim())
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Save Filter Preset"
      footer={
        <>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={name.trim() === ''}>Save</button>
        </>
      }
    >
      <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Preset name</label>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        placeholder="e.g. This week's orders"
        style={{ padding: '0.5rem', width: '100%', marginTop: '0.4rem' }}
      />
    </Modal>
  )
}
