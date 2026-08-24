import { useState } from 'react'
import { overlayStyle, dropdownStyle } from './recordsUiKit'
import { InvoiceModal } from '../InvoiceModal'
import { printReceipt } from '../receiptPrint'
import { isRetailTemplate } from '../lib/templateFlags'

export function CartCell({ value, cellKey, openCartCellKey, setOpenCartCellKey, form, submission }) {
  const [showInvoice, setShowInvoice] = useState(false)
  const isRetail = isRetailTemplate(form)

  if (!value || !value.items || value.items.length === 0) {
    return <span style={{ color: '#ccc' }}>-</span>
  }

  const isOpen = openCartCellKey === cellKey

  const summary = value.items.map(item => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join(', ')

  return (
    <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <span
        onClick={() => setOpenCartCellKey(isOpen ? null : cellKey)}
        title={summary}
        style={{
          cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', maxWidth: '280px', lineHeight: 1.3
        }}
      >
        {summary}
      </span>

      {isOpen && (
        <>
          <div style={overlayStyle} onClick={() => setOpenCartCellKey(null)} />
          <div className="dropdown-panel" style={{ ...dropdownStyle, right: 'auto', left: 0, minWidth: '260px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
              Order Details
            </div>
            {value.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: '0.6rem',
                fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <span>{item.name} <span style={{ color: '#999' }}>× {item.quantity}</span></span>
                <span style={{ whiteSpace: 'nowrap' }}>₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span>Total</span>
              <span>₦{value.total.toLocaleString()}</span>
            </div>
            {form && submission && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isRetail) setShowInvoice(true)
                  else printReceipt(form, submission)
                }}
                style={{ width: '100%', marginTop: '0.7rem', fontSize: '0.8rem' }}
              >
                {isRetail ? 'Invoice' : 'Print'}
              </button>
            )}
          </div>
        </>
      )}

      {isRetail && showInvoice && (
        <InvoiceModal form={form} submission={submission} onClose={() => setShowInvoice(false)} allowDateEdit />
      )}
    </span>
  )
}
