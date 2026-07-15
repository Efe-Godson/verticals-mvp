// Place at: src/report/components/CartLineItemsTable.jsx

const thStyle = {
  textAlign: 'left', padding: '0.5rem 0.7rem', background: '#fafafa',
  borderBottom: '1px solid #eee', position: 'sticky', top: 0
}
const tdStyle = { padding: '0.5rem 0.7rem', borderBottom: '1px solid #f5f5f5' }

function CartLineItemsTable({ field, answered }) {
  const rows = []
  answered.forEach(s => {
    const items = s.data[field.id].items || []
    items.forEach(item => {
      rows.push({
        date: s.created_at,
        name: item.name,
        category: item.category || '',
        quantity: item.quantity,
        price: item.price,
        lineTotal: item.price * item.quantity
      })
    })
  })

  rows.sort((a, b) => new Date(b.date) - new Date(a.date))

  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
        Line Items ({rows.length})
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Unit Price</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdStyle}>
                  {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>{row.category || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{row.quantity}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{row.price.toLocaleString()}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{row.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CartLineItemsTable
