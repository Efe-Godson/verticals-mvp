// Place at: src/report/engine/datasets.js
// The Report Builder can query more than "this form's submissions". A store
// / workflow built on Verticals keeps its data in a few conceptual tables -
// Orders, Sale line items, Products & Inventory, Customers - all derived
// from the same forms + submissions. buildDatasets() turns each into the
// { form, submissions } shape the engine already understands, so runQuery /
// listFields / every renderer work unchanged.
//
// Each synthetic "form" is just { id, name, fields:[{id,label,type}] }; each
// synthetic "submission" is { id, created_at, data:{fieldId:value} }.

const D = 'dropdown' // -> dimension
const N = 'number'   // -> measure
const DT = 'date'    // -> date dimension
const T = 'text'     // -> text dimension

function synthForm(id, name, fields) {
  return { id, name, fields: fields.map(f => ({ ...f, label: f.label || f.id })) }
}

function firstCartField(form) {
  return (form?.fields || []).find(f => f.type === 'cart') || null
}

// Categorical / text fields on the real form that are worth carrying into a
// derived dataset as extra dimensions (sales channel, rep, customer name…).
function passthroughFields(form) {
  return (form?.fields || []).filter(f =>
    ['dropdown', 'multiplechoice', 'autocomplete', 'text', 'phone', 'email'].includes(f.type),
  )
}

function isEmpty(v) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

// ---- Orders (the form itself) -----------------------------------------

function ordersDataset(form, submissions) {
  return { id: 'orders', label: 'Orders', form, submissions }
}

// ---- Sale line items -------------------------------------------------

function lineItemsDataset(form, submissions) {
  const cart = firstCartField(form)
  if (!cart) return null
  const extras = passthroughFields(form)

  const fields = [
    { id: 'product', label: 'Product', type: T },
    { id: 'category', label: 'Category', type: D },
    { id: 'quantity', label: 'Quantity', type: N },
    { id: 'unit_price', label: 'Unit Price', type: N },
    { id: 'line_total', label: 'Line Revenue', type: N },
    { id: 'order_date', label: 'Order Date', type: DT },
    ...extras.map(f => ({ id: `x_${f.id}`, label: f.label || f.id, type: ['text', 'phone', 'email'].includes(f.type) ? T : D })),
  ]

  const rows = []
  submissions.forEach(sub => {
    const v = sub.data?.[cart.id]
    if (!v || !Array.isArray(v.items) || v.items.length === 0) return
    v.items.forEach((it, i) => {
      const qty = Number(it.quantity) || 0
      const price = Number(it.price) || 0
      const data = {
        product: it.name || '—',
        category: (it.category && String(it.category).trim()) || 'Uncategorized',
        quantity: qty,
        unit_price: price,
        line_total: qty * price,
        order_date: sub.created_at,
      }
      extras.forEach(f => {
        const raw = sub.data?.[f.id]
        data[`x_${f.id}`] = Array.isArray(raw) ? raw.join(', ') : (raw ?? '')
      })
      rows.push({ id: `${sub.id}:${i}`, created_at: sub.created_at, data })
    })
  })

  if (rows.length === 0) return null
  return { id: 'lineItems', label: 'Sale line items', form: synthForm('ds_line_items', 'Sale line items', fields), submissions: rows }
}

// ---- Products & Inventory ------------------------------------------

function productsDataset(form) {
  const cart = firstCartField(form)
  const products = cart?.products || []
  if (products.length === 0) return null

  const fields = [
    { id: 'name', label: 'Product', type: T },
    { id: 'category', label: 'Category', type: D },
    { id: 'price', label: 'Price', type: N },
    { id: 'stock_quantity', label: 'Stock Quantity', type: N },
    { id: 'tracked', label: 'Inventory Tracked', type: D },
    { id: 'stock_status', label: 'Stock Status', type: D },
    { id: 'unit', label: 'Unit', type: D },
    { id: 'barcode', label: 'Barcode', type: T },
  ]

  const rows = products.map((p, i) => {
    const stock = Number(p.stockQuantity) || 0
    const tracked = !!p.trackInventory
    return {
      id: p.id || `p_${i}`,
      created_at: null,
      data: {
        name: p.name || '—',
        category: (p.category && String(p.category).trim()) || 'Uncategorized',
        price: Number(p.price) || 0,
        stock_quantity: tracked ? stock : null,
        tracked: tracked ? 'Tracked' : 'Not tracked',
        stock_status: !tracked ? 'Not tracked' : stock <= 0 ? 'Out of stock' : stock <= 5 ? 'Low' : 'In stock',
        unit: p.unit || '',
        barcode: p.barcode || '',
      },
    }
  })

  return { id: 'products', label: 'Products & Inventory', form: synthForm('ds_products', 'Products & Inventory', fields), submissions: rows }
}

// ---- Customers -----------------------------------------------------

// The field that identifies a customer: an explicit name/customer field,
// else the first phone, else the first email.
function customerKeyField(form) {
  const fields = form?.fields || []
  return (
    fields.find(f => ['text', 'phone', 'email'].includes(f.type) && /name|customer|client|guest/i.test(f.label || '')) ||
    fields.find(f => f.type === 'phone') ||
    fields.find(f => f.type === 'email') ||
    null
  )
}

function customersDataset(form, submissions) {
  const key = customerKeyField(form)
  const cart = firstCartField(form)
  if (!key) return null

  const fields = [
    { id: 'customer', label: 'Customer', type: T },
    { id: 'orders', label: 'Orders', type: N },
    { id: 'total_spent', label: 'Total Spent', type: N },
    { id: 'avg_order', label: 'Average Order', type: N },
    { id: 'first_order', label: 'First Order', type: DT },
    { id: 'last_order', label: 'Last Order', type: DT },
  ]

  const byCustomer = {}
  submissions.forEach(sub => {
    const raw = sub.data?.[key.id]
    if (isEmpty(raw)) return
    const name = String(Array.isArray(raw) ? raw[0] : raw).trim()
    if (!name) return
    const c = byCustomer[name] || (byCustomer[name] = { orders: 0, spent: 0, first: sub.created_at, last: sub.created_at })
    c.orders += 1
    if (cart) {
      const v = sub.data?.[cart.id]
      if (v && Array.isArray(v.items) && v.items.length) c.spent += (Number(v.total) || 0) + (Number(v.deliveryFee) || 0)
    }
    if (new Date(sub.created_at) < new Date(c.first)) c.first = sub.created_at
    if (new Date(sub.created_at) > new Date(c.last)) c.last = sub.created_at
  })

  const rows = Object.entries(byCustomer).map(([name, c], i) => ({
    id: `c_${i}`,
    created_at: c.last,
    data: {
      customer: name,
      orders: c.orders,
      total_spent: Math.round(c.spent),
      avg_order: c.orders ? Math.round(c.spent / c.orders) : 0,
      first_order: c.first,
      last_order: c.last,
    },
  }))

  if (rows.length === 0) return null
  return { id: 'customers', label: 'Customers', form: synthForm('ds_customers', 'Customers', fields), submissions: rows }
}

// ---- public -------------------------------------------------------

// Always returns at least [Orders]. Order: Orders, Sale line items,
// Products & Inventory, Customers - each included only when it has data.
export function buildDatasets(form, submissions = []) {
  return [
    ordersDataset(form, submissions),
    lineItemsDataset(form, submissions),
    productsDataset(form),
    customersDataset(form, submissions),
  ].filter(Boolean)
}
