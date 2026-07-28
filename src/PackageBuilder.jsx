// Place at: src/PackageBuilder.jsx
// Bundles 2+ existing products in a cart field into a single purchasable
// "package" product with its own price — reused by CreateForm.jsx and
// EditForm.jsx. The package is just a regular product entry with
// isPackage: true and bundleItems recording what it's made of (for
// reference only; the respondent buys the package as one line item at the
// price set here, not the sum of its parts).
import { useState } from 'react'

function PackageBuilder({ products, onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [selected, setSelected] = useState({}) // productId -> quantity

  const bundleable = products.filter(p => !p.isPackage)

  function toggleProduct(id) {
    setSelected(current => {
      const next = { ...current }
      if (next[id]) delete next[id]
      else next[id] = 1
      return next
    })
  }

  function setQty(id, qty) {
    setSelected(current => ({ ...current, [id]: Math.max(1, Math.floor(Number(qty)) || 1) }))
  }

  const selectedIds = Object.keys(selected)
  const individualTotal = selectedIds.reduce((sum, id) => {
    const p = bundleable.find(p => p.id === id)
    return sum + (p ? Number(p.price || 0) * selected[id] : 0)
  }, 0)

  const canCreate = name.trim() !== '' && selectedIds.length > 0 && price !== ''

  function handleCreate() {
    if (!canCreate) return
    onCreate({
      name: name.trim(),
      price: Number(price) || 0,
      category: 'Package',
      isPackage: true,
      bundleItems: selectedIds.map(id => ({ productId: id, quantity: selected[id] })),
    })
  }

  return (
    <div className="card" style={{ padding: '1rem', marginTop: '0.5rem', background: 'linear-gradient(135deg, #f8faff 0%, #f3f7ff 100%)' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem' }}>Create Package</div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Package name, e.g. Starter Bundle"
        style={{ padding: '0.4rem', width: '100%', marginBottom: '0.6rem' }}
      />

      {bundleable.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Add some products first, then you can bundle them into a package.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '0.6rem' }}>
          {bundleable.map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleProduct(p.id)} />
              <span style={{ flex: 1 }}>{p.name || 'Untitled product'} (₦{Number(p.price || 0).toLocaleString()})</span>
              {selected[p.id] && (
                <input
                  type="number" min="1" value={selected[p.id]}
                  onChange={(e) => setQty(p.id, e.target.value)}
                  style={{ width: '55px', padding: '0.2rem' }}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
          Individual total: ₦{individualTotal.toLocaleString()}
        </p>
      )}

      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Package price"
        style={{ padding: '0.4rem', width: '100%', marginBottom: '0.7rem' }}
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={handleCreate} disabled={!canCreate}>Create Package</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default PackageBuilder
