// Place at: src/Inventory.jsx
// Stock levels for a cart-based form's product catalogue - same "read the
// form, table + search/filter, edit-in-place" shape as Records.jsx, but the
// rows are products (read straight from the cart field's own products
// array, see ProductManager.jsx) instead of submissions. There's no
// separate inventory table: stockQuantity/trackInventory already live on
// each product object, they just weren't shown or acted on anywhere until
// now. Restocking here is a plain read-modify-write against forms.fields
// (matching every other settings/field edit in this app); the decrement
// side, which actually needs to survive concurrent sales, is handled
// atomically server-side instead - see the apply_cart_stock_changes
// migration and submit-form/index.ts.
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PosSidePanel from './PosSidePanel'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'

const LOW_STOCK_THRESHOLD = 5

function RestockModal({ product, onSave, onCancel }) {
  const [addQty, setAddQty] = useState('')
  const [setQty, setSetQty] = useState('')

  const canAdd = addQty !== '' && Number(addQty) > 0
  const canSet = setQty !== '' && Number(setQty) >= 0

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'var(--color-surface)', padding: '1.5rem', width: '380px', maxWidth: '100%' }}
      >
        <h3 style={{ margin: '0 0 0.2rem' }}>{product.name}</h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          Current stock: {Number(product.stockQuantity) || 0}{product.unit ? ` ${product.unit}` : ''}
        </p>

        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Add stock</label>
        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.3rem 0 1rem' }}>
          <input
            type="number" min="1" value={addQty} onChange={(e) => setAddQty(e.target.value)}
            placeholder="Quantity received" style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="button" disabled={!canAdd} onClick={() => onSave((Number(product.stockQuantity) || 0) + Number(addQty))}>
            Add
          </button>
        </div>

        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Or set exact count (e.g. after a stocktake)</label>
        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.3rem 0 1rem' }}>
          <input
            type="number" min="0" value={setQty} onChange={(e) => setSetQty(e.target.value)}
            placeholder="New count" style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="button" className="secondary" disabled={!canSet} onClick={() => onSave(Number(setQty))}>
            Set
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function Inventory() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isFocusMode = searchParams.get('focus') === '1'
  const { showToast } = useToast()

  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [restockingProduct, setRestockingProduct] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadForm() {
      setLoading(true)
      const { data, error: formError } = await supabase.from('forms').select('*').eq('id', id).single()
      if (formError || !data) {
        setError('This form could not be found.')
        setLoading(false)
        return
      }
      setForm(data)
      setLoading(false)
    }
    loadForm()
  }, [id])

  if (loading) return <LoadingState label="Loading inventory..." />
  if (error) return <ErrorState message={error} />

  const cartField = form.fields.find(f => f.type === 'cart')
  if (!cartField) {
    return (
      <div className="page">
        {isFocusMode && <PosSidePanel formId={form.id} hasCartField={false} />}
        <h1>Inventory</h1>
        <p style={{ color: 'var(--color-muted)' }}>This form doesn't have a product catalogue to track stock for.</p>
      </div>
    )
  }

  const products = cartField.products || []
  const trackedProducts = products.filter(p => p.trackInventory)
  const lowStockCount = trackedProducts.filter(p => (Number(p.stockQuantity) || 0) <= LOW_STOCK_THRESHOLD).length

  const categoryNames = Array.from(new Set(products.map(p => p.category).filter(c => c && c.trim() !== '')))
  const categories = ['All', ...categoryNames]

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  // Same read-modify-write shape as Records.jsx's updateFormSettings, just
  // against `fields` instead of `settings` - fine here since restocking is a
  // rare, deliberate, single-admin action, unlike the concurrent-sale
  // decrement path this deliberately doesn't share (see the migration).
  async function saveProduct(productId, patch) {
    setSaving(true)
    const updatedFields = form.fields.map(f => {
      if (f.id !== cartField.id) return f
      return { ...f, products: f.products.map(p => p.id === productId ? { ...p, ...patch } : p) }
    })
    const { error: updateError } = await supabase.from('forms').update({ fields: updatedFields }).eq('id', form.id)
    setSaving(false)
    if (updateError) {
      showToast('Could not save: ' + updateError.message, 'error')
      return
    }
    setForm({ ...form, fields: updatedFields })
  }

  async function handleRestock(newQuantity) {
    const product = restockingProduct
    setRestockingProduct(null)
    await saveProduct(product.id, { stockQuantity: newQuantity })
    showToast(`${product.name} stock updated to ${newQuantity}.`, 'success')
  }

  async function enableTracking(product) {
    await saveProduct(product.id, { trackInventory: true, stockQuantity: 0 })
  }

  return (
    <div className="page" style={isFocusMode ? { paddingTop: '4rem' } : undefined}>
      {isFocusMode && <PosSidePanel formId={form.id} hasCartField={true} />}
      <h1 style={{ margin: 0 }}>Inventory</h1>
      <p style={{ color: 'var(--color-muted)', margin: '0.3rem 0 1.2rem' }}>{form.name}</p>

      {products.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No products yet - add some from the order screen's product catalogue first.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem', marginBottom: '1.2rem' }}>
            <div className="card" style={{ padding: '0.9rem 1rem', background: 'var(--color-primary-soft)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>
                Tracked Products
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{trackedProducts.length}</div>
            </div>
            <div className="card" style={{ padding: '0.9rem 1rem', background: 'var(--color-primary-soft)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>
                Low Stock
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: lowStockCount > 0 ? '#c0392b' : 'inherit' }}>{lowStockCount}</div>
            </div>
          </div>

          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search products..." style={{ width: '100%', padding: '0.5rem', marginBottom: '0.7rem' }}
          />

          {categories.length > 1 && (
            <div className="category-scroll" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', overflowX: 'auto', marginBottom: '0.9rem' }}>
              {categories.map(cat => (
                <button
                  key={cat} type="button" onClick={() => setActiveCategory(cat)}
                  className={activeCategory === cat ? '' : 'secondary'}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--color-muted)' }}>No products match your search.</p>
          ) : (
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Price</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Stock</th>
                    <th style={{ width: '110px', borderBottom: '1px solid var(--color-border)' }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const stock = Number(p.stockQuantity) || 0
                    const isLow = p.trackInventory && stock <= LOW_STOCK_THRESHOLD
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--color-muted)' }}>{p.category || '-'}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>₦{Number(p.price).toLocaleString()}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>
                          {p.trackInventory ? (
                            <span style={{ fontWeight: 600, color: isLow ? '#c0392b' : 'inherit' }}>
                              {stock}{p.unit ? ` ${p.unit}` : ''}{isLow && ' (low)'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-muted)' }}>Not tracked</span>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                          {p.trackInventory ? (
                            <button type="button" className="secondary" disabled={saving} onClick={() => setRestockingProduct(p)}>
                              Restock
                            </button>
                          ) : (
                            <button type="button" className="secondary" disabled={saving} onClick={() => enableTracking(p)}>
                              Track
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {restockingProduct && (
        <RestockModal
          product={restockingProduct}
          onSave={handleRestock}
          onCancel={() => setRestockingProduct(null)}
        />
      )}
    </div>
  )
}

export default Inventory
