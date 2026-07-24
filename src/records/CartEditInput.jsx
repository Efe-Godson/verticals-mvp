export function CartEditInput({ field, value, onChange }) {
  const products = field.products || []
  const items = value?.items || []

  function updateQuantity(productId, rawQty) {
    const numQty = Math.max(0, Math.floor(Number(rawQty)) || 0)
    const catalogueProduct = products.find(p => p.id === productId)
    const existingItem = items.find(i => i.id === productId)
    const source = catalogueProduct || existingItem
    if (!source) return

    let newItems
    if (numQty === 0) {
      newItems = items.filter(i => i.id !== productId)
    } else if (existingItem) {
      newItems = items.map(i => i.id === productId ? { ...i, quantity: numQty } : i)
    } else {
      newItems = [...items, {
        id: source.id, name: source.name, price: source.price,
        category: source.category || '', quantity: numQty
      }]
    }

    const total = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    onChange({ items: newItems, total })
  }

  // Show every product in the form's catalogue (quantity 0 if not currently in the cart),
  // plus any cart item whose product has since been removed from the catalogue —
  // so it stays visible and adjustable rather than silently vanishing.
  const rows = products.map(p => {
    const existing = items.find(i => i.id === p.id)
    return { ...p, quantity: existing ? existing.quantity : 0 }
  })
  items.forEach(i => {
    if (!products.some(p => p.id === i.id)) rows.push({ ...i })
  })

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '260px', overflowY: 'auto' }}>
        {rows.map(row => (
          <div key={row.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5'
          }}>
            <div style={{ fontSize: '0.85rem' }}>
              {row.name}{' '}
              <span style={{ color: '#999', fontSize: '0.75rem' }}>
                ₦{Number(row.price).toLocaleString()}
              </span>
            </div>
            <input
              type="number"
              min="0"
              value={row.quantity}
              onChange={(e) => updateQuantity(row.id, e.target.value)}
              style={{ width: '70px', padding: '0.3rem', textAlign: 'center' }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.7rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
        <span>Total</span>
        <span>₦{total.toLocaleString()}</span>
      </div>
    </div>
  )
}
