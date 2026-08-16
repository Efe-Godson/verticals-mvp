// Place at: src/ProductManager.jsx
// The Product Cart field's catalogue editor, pulled out of the inline
// 300-line block in CreateForm.jsx/EditForm.jsx into its own "mini
// inventory manager": a collapsed product table with search/category
// filters, a proper Add/Edit Product modal (unit, category, tax, SKU,
// barcode, inventory tracking - fields the inline row editor never had
// room for), and Import/Package as their own modals instead of buttons
// crowding the field. Products stay embedded in the form's own field
// definition for now; there's no shared catalog across forms yet.
import { useState } from 'react'
import * as XLSX from 'xlsx'
import PackageBuilder from './PackageBuilder'
import ConfirmDialog from './ConfirmDialog'
import SparkleIcon from './SparkleIcon'
import { extractProductsFromText, describeAIError } from './lib/aiClient'
import { ExtractingOverlay } from './LoadingState'

function newProductId() {
  return 'p' + Date.now() + Math.random().toString(36).slice(2, 7)
}

const TOP_CATEGORY_COUNT = 6 // category pills shown before collapsing the rest behind "+N more"

function ProductForm({ product, onSave, onCancel }) {
  const [showMore, setShowMore] = useState(false)
  const [values, setValues] = useState({
    name: product?.name || '',
    price: product?.price ?? '',
    unit: product?.unit || '',
    category: product?.category || '',
    imageUrl: product?.imageUrl || '',
    description: product?.description || '',
    taxPercent: product?.taxPercent ?? '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    trackInventory: !!product?.trackInventory,
    stockQuantity: product?.stockQuantity ?? '',
  })

  function set(patch) {
    setValues(current => ({ ...current, ...patch }))
  }

  const canSave = values.name.trim() !== '' && values.price !== ''

  function handleSave() {
    if (!canSave) return
    onSave({
      ...product,
      id: product?.id || newProductId(),
      name: values.name.trim(),
      price: Number(values.price) || 0,
      unit: values.unit.trim(),
      category: values.category.trim(),
      imageUrl: values.imageUrl.trim(),
      description: values.description.trim(),
      taxPercent: values.taxPercent === '' ? undefined : Number(values.taxPercent) || 0,
      sku: values.sku.trim(),
      barcode: values.barcode.trim(),
      trackInventory: values.trackInventory,
      stockQuantity: values.trackInventory ? (Number(values.stockQuantity) || 0) : undefined,
    })
  }

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
        style={{ background: 'white', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{product ? 'Edit Product' : 'Add Product'}</h3>

        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Product Name</label>
        <input
          type="text" value={values.name} onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Grilled Chicken" style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.8rem' }}
        />

        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Price</label>
            <input
              type="number" min="0" value={values.price} onChange={(e) => set({ price: e.target.value })}
              placeholder="0.00" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Unit</label>
            <input
              type="text" value={values.unit} onChange={(e) => set({ unit: e.target.value })}
              placeholder="pcs, kg, plate..." style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}
            />
          </div>
        </div>

        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Category</label>
        <input
          type="text" value={values.category} onChange={(e) => set({ category: e.target.value })}
          placeholder="e.g. Mains" style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.8rem' }}
        />

        <div
          onClick={() => setShowMore(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none',
            fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600, marginBottom: showMore ? '0.8rem' : '0.5rem'
          }}
        >
          <span style={{ transform: showMore ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', fontSize: '0.7rem' }}>▾</span>
          {showMore ? 'Fewer options' : 'More options'}
        </div>

        {showMore && (
          <>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Image URL (optional)</label>
            <input
              type="text" value={values.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })}
              placeholder="https://..." style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.8rem' }}
            />

            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Description (optional)</label>
            <textarea
              value={values.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="Short description shown to customers" style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.8rem', minHeight: '60px' }}
            />

            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Tax %</label>
                <input
                  type="number" min="0" value={values.taxPercent} onChange={(e) => set({ taxPercent: e.target.value })}
                  placeholder="0" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>SKU</label>
                <input
                  type="text" value={values.sku} onChange={(e) => set({ sku: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}
                />
              </div>
            </div>

            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Barcode</label>
            <input
              type="text" value={values.barcode} onChange={(e) => set({ barcode: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', margin: '0.3rem 0 0.8rem' }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={values.trackInventory} onChange={(e) => set({ trackInventory: e.target.checked })} />
              Enable Inventory Tracking
            </label>

            {values.trackInventory && (
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Stock Quantity</label>
                <input
                  type="number" min="0" value={values.stockQuantity} onChange={(e) => set({ stockQuantity: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}
                />
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="button" disabled={!canSave} onClick={handleSave}>Save Product</button>
        </div>
      </div>
    </div>
  )
}

// Paste text -> AI extracts a product list -> reviewed/edited here -> only
// then merged into the catalogue. Deliberately not a one-click import like
// the .xlsx upload: an AI read of pasted text is more likely to need a
// correction (a misread price, a name it cleaned up wrong) than a
// structured file already is, so this always stops for a look first.
function AiImportModal({ onClose, onImport }) {
  const [pastedText, setPastedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [drafts, setDrafts] = useState(null) // null while still on the paste step, else the reviewable array

  async function handleExtract() {
    if (!pastedText.trim()) return
    setExtracting(true)
    setExtractError('')
    try {
      const products = await extractProductsFromText(pastedText)
      if (!products.length) {
        setExtractError("Couldn't find any products in that text - try pasting more of it, or check it's the right content.")
        return
      }
      setDrafts(products.map(p => ({ ...p, id: newProductId() })))
    } catch (err) {
      setExtractError(await describeAIError(err, "Couldn't read that text right now - please try again in a moment."))
    } finally {
      setExtracting(false)
    }
  }

  function updateDraft(id, patch) {
    setDrafts(current => current.map(d => d.id === id ? { ...d, ...patch } : d))
  }

  function removeDraft(id) {
    setDrafts(current => current.filter(d => d.id !== id))
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'white', padding: '1.5rem', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SparkleIcon size={18} /> Use AI to add new products
        </h3>

        {drafts === null ? (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
              Paste a menu, price list, or product list from anywhere - a PDF, a spreadsheet, a message - and AI will turn it into products you can review before adding.
            </p>
            <div style={{ position: 'relative' }}>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'e.g.\nGrilled Chicken - 12.99\nBeef Burger 10.99 (Mains)\nSoft Drink ......... 2.50'}
                rows={10}
                disabled={extracting}
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem' }}
              />
              {extracting && <ExtractingOverlay label="Reading your text..." />}
            </div>
            {extractError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '0.5rem' }}>{extractError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
              <button type="button" className="secondary" onClick={onClose}>Cancel</button>
              <button type="button" disabled={!pastedText.trim() || extracting} onClick={handleExtract}>
                {extracting ? 'Reading...' : 'Extract Products'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 0.8rem' }}>
              Found {drafts.length} product{drafts.length !== 1 ? 's' : ''} - review and edit before adding them to your menu.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {drafts.map(d => (
                <div key={d.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0.5rem' }}>
                  <input
                    type="text" value={d.name} onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                    placeholder="Name" style={{ flex: 2, minWidth: 0, padding: '0.4rem' }}
                  />
                  <input
                    type="number" min="0" value={d.price} onChange={(e) => updateDraft(d.id, { price: e.target.value })}
                    placeholder="Price" style={{ flex: 1, minWidth: '70px', padding: '0.4rem' }}
                  />
                  <input
                    type="text" value={d.category} onChange={(e) => updateDraft(d.id, { category: e.target.value })}
                    placeholder="Category" style={{ flex: 1, minWidth: '90px', padding: '0.4rem' }}
                  />
                  <span onClick={() => removeDraft(d.id)} title="Remove" style={{ color: '#c0392b', cursor: 'pointer', flexShrink: 0, padding: '0 0.2rem' }}>
                    🗑
                  </span>
                </div>
              ))}
              {drafts.length === 0 && (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Nothing left to add - remove some and try again, or cancel.</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setDrafts(null)}>Back</button>
              <button
                type="button"
                disabled={drafts.length === 0}
                onClick={() => onImport(drafts.map(d => ({ ...d, price: Number(d.price) || 0 })))}
              >
                Add {drafts.length} Product{drafts.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProductManager({ products, onChange, onClose, inline = false, hideAiImport = false }) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [editingProduct, setEditingProduct] = useState(null) // null closed, 'new', or a product object
  const [openRowMenuId, setOpenRowMenuId] = useState(null)
  const [showPackageBuilder, setShowPackageBuilder] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [showAiImport, setShowAiImport] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [confirmingClearAll, setConfirmingClearAll] = useState(false)
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)

  const categoryNames = Array.from(new Set(products.map(p => p.category).filter(c => c && c.trim() !== '')))
  const categoryCounts = { All: products.length }
  categoryNames.forEach(cat => { categoryCounts[cat] = products.filter(p => p.category === cat).length })

  // Same treatment as the customer-facing menu (PublicForm.jsx): lead with
  // the biggest categories and tuck the long tail behind "+N more" instead
  // of wrapping a dozen-plus pills across several rows.
  const sortedCategoryNames = [...categoryNames].sort((a, b) => categoryCounts[b] - categoryCounts[a])
  let visibleCategoryNames = categoriesExpanded ? sortedCategoryNames : sortedCategoryNames.slice(0, TOP_CATEGORY_COUNT)
  if (activeCategory !== 'All' && !visibleCategoryNames.includes(activeCategory)) {
    visibleCategoryNames = [...visibleCategoryNames, activeCategory]
  }
  const hiddenCategoryCount = sortedCategoryNames.length - visibleCategoryNames.length
  const categories = ['All', ...visibleCategoryNames]

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  function saveProduct(product) {
    const exists = products.some(p => p.id === product.id)
    onChange(exists ? products.map(p => p.id === product.id ? product : p) : [...products, product])
    setEditingProduct(null)
  }

  function duplicateProduct(product) {
    onChange([...products, { ...product, id: newProductId(), name: `${product.name} (Copy)` }])
    setOpenRowMenuId(null)
  }

  function deleteProduct(productId) {
    onChange(products.filter(p => p.id !== productId))
    setPendingDeleteId(null)
  }

  function clearAllProducts() {
    onChange([])
    setConfirmingClearAll(false)
  }

  function addPackage(packageData) {
    onChange([...products, { id: newProductId(), ...packageData }])
    setShowPackageBuilder(false)
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([
      { Name: 'Sample Product', Price: 1000, Unit: 'kg', Category: 'Category Name' },
      { Name: 'Another Product', Price: 2500, Unit: 'pcs', Category: 'Category Name' }
    ])
    worksheet['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 20 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
    XLSX.writeFile(workbook, 'product-catalogue-template.xlsx')
    setImportMenuOpen(false)
  }

  function handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet)

        const imported = rows
          .filter(row => row.Name && row.Name.toString().trim() !== '')
          .map(row => ({
            id: newProductId(),
            name: row.Name.toString().trim(),
            price: Number(row.Price) || 0,
            unit: row.Unit ? row.Unit.toString().trim() : '',
            category: row.Category ? row.Category.toString().trim() : ''
          }))

        if (imported.length > 0) onChange([...products, ...imported])
      } catch {
        // Silently ignored - a malformed file just imports nothing.
      }
    }
    reader.readAsArrayBuffer(file)
    event.target.value = ''
    setImportMenuOpen(false)
  }

  const content = (
    <>
        {/* On a phone, flex-wrap alone leaves this row ragged - "Import"
            wrapping alone onto its own mostly-empty line, "Clear All" doing
            the same below it. A 2-column grid keeps every button/menu the
            same width and packed evenly instead. */}
        <style>{`
          @media (max-width: 480px) {
            .product-actions-row {
              display: grid !important;
              grid-template-columns: 1fr 1fr;
            }
            .product-actions-row > * { width: 100%; }
            .product-actions-row > div > button { width: 100%; }
            .product-actions-ai { grid-column: 1 / -1; }
          }
        `}</style>

        {!inline && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Menu</h3>
            <button className="secondary" onClick={onClose}>Close</button>
          </div>
        )}

        <div className="product-actions-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <button type="button" className="secondary" onClick={() => setEditingProduct('new')}>+ Add Product</button>
          <button type="button" className="secondary" onClick={() => setShowPackageBuilder(true)}>+ Create Package</button>
          <div style={{ position: 'relative' }}>
            <button type="button" className="secondary" onClick={() => setImportMenuOpen(o => !o)}>Import ▾</button>
            {importMenuOpen && (
              <>
                <div onClick={() => setImportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
                <div className="dropdown-panel" style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '0.3rem', background: 'white',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '200px', padding: '0.4rem'
                }}>
                  <label className="secondary" style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 'none',
                    padding: '0.45rem 0.6rem', fontSize: '0.85rem', background: 'transparent', cursor: 'pointer'
                  }}>
                    Upload File (.xlsx, .csv)
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  <button
                    type="button" className="secondary" onClick={downloadTemplate}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '0.45rem 0.6rem', fontSize: '0.85rem', background: 'transparent' }}
                  >
                    Download Template
                  </button>
                </div>
              </>
            )}
          </div>
          {products.length > 0 && (
            <button type="button" className="secondary" style={{ color: '#c0392b' }} onClick={() => setConfirmingClearAll(true)}>
              Clear All
            </button>
          )}
          {/* Its own full row, below everything else - the flagship way to
              build a catalogue from scratch, not just one more tile among
              the smaller housekeeping actions above it. Restaurant doesn't
              get this at all (see lib/templateFlags.js) - back to exactly
              how it worked before AI import existed. */}
          {!hideAiImport && (
            <button
              type="button"
              className="product-actions-ai"
              onClick={() => setShowAiImport(true)}
              style={{ fontWeight: 600, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <SparkleIcon /> Use AI to add new products
            </button>
          )}
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
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
            {hiddenCategoryCount > 0 && (
              <button
                type="button" className="secondary" onClick={() => setCategoriesExpanded(true)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                +{hiddenCategoryCount} more
              </button>
            )}
            {categoriesExpanded && sortedCategoryNames.length > TOP_CATEGORY_COUNT && (
              <button
                type="button" className="secondary" onClick={() => setCategoriesExpanded(false)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Show less
              </button>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>No products yet. Click "+ Add Product" to start building the menu.</p>
        ) : (
          // A 5-column table doesn't shrink to fit a phone screen the way
          // flex/grid layouts do - table-scroll (same class Records.jsx
          // uses) keeps the overflow contained to just this table instead
          // of either clipping the Category column/menu button off-screen
          // or forcing the whole page to scroll sideways.
          <div className="table-scroll" style={{ marginTop: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Price</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Unit</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)' }}>Category</th>
                  <th style={{ width: '36px', borderBottom: '1px solid var(--color-border)' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>
                      {p.name}
                      {p.isPackage && (
                        <span style={{
                          marginLeft: '0.5rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-primary)',
                          border: '1px solid var(--color-primary)', borderRadius: '999px', padding: '0.05rem 0.4rem'
                        }}>
                          PACKAGE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>₦{Number(p.price).toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--color-muted)' }}>{p.unit || '-'}</td>
                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--color-muted)' }}>{p.category || '-'}</td>
                    <td style={{ padding: '0.6rem 0.4rem', position: 'relative' }}>
                      <button
                        type="button" className="secondary" onClick={() => setOpenRowMenuId(openRowMenuId === p.id ? null : p.id)}
                        style={{ padding: '0.2rem 0.5rem' }}
                      >
                        ⋮
                      </button>
                      {openRowMenuId === p.id && (
                        <>
                          <div onClick={() => setOpenRowMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
                          <div className="dropdown-panel" style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem', background: 'white',
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '130px', padding: '0.4rem'
                          }}>
                            <button type="button" className="secondary" onClick={() => { setEditingProduct(p); setOpenRowMenuId(null) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '0.4rem 0.5rem', fontSize: '0.85rem', background: 'transparent' }}>
                              Edit
                            </button>
                            <button type="button" className="secondary" onClick={() => duplicateProduct(p)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '0.4rem 0.5rem', fontSize: '0.85rem', background: 'transparent' }}>
                              Duplicate
                            </button>
                            <button type="button" className="secondary" onClick={() => { setPendingDeleteId(p.id); setOpenRowMenuId(null) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '0.4rem 0.5rem', fontSize: '0.85rem', background: 'transparent', color: '#c0392b' }}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  )

  return (
    <>
      {inline ? (
        <div style={{ marginTop: '0.8rem' }}>{content}</div>
      ) : (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ background: 'white', padding: '1.5rem', width: '720px', maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto' }}
          >
            {content}
          </div>
        </div>
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct === 'new' ? null : editingProduct}
          onSave={saveProduct}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {showPackageBuilder && (
        <div
          onClick={() => setShowPackageBuilder(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '100%' }}>
            <PackageBuilder products={products} onCreate={addPackage} onCancel={() => setShowPackageBuilder(false)} />
          </div>
        </div>
      )}

      {showAiImport && (
        <AiImportModal
          onClose={() => setShowAiImport(false)}
          onImport={(imported) => { onChange([...products, ...imported]); setShowAiImport(false) }}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Remove this product?"
          message="This will remove the product from your menu."
          confirmLabel="Remove"
          danger
          onConfirm={() => deleteProduct(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {confirmingClearAll && (
        <ConfirmDialog
          title="Clear the entire menu?"
          message={`This removes all ${products.length} product${products.length !== 1 ? 's' : ''} from this menu.`}
          confirmLabel="Clear All"
          danger
          onConfirm={clearAllProducts}
          onCancel={() => setConfirmingClearAll(false)}
        />
      )}
    </>
  )
}

export default ProductManager
