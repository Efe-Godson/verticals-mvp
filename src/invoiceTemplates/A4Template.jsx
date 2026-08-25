// Place at: src/invoiceTemplates/A4Template.jsx
// The "A4" invoice view - a proper full-page business-document layout, as
// opposed to the 4 compact styles in this same folder. Fixed true A4
// portrait dimensions (210mm x 297mm) with print-safe margins; this is
// captured/printed at its real size (see InvoiceModal.jsx's dual-render
// setup) - never the shrunk-to-fit on-screen preview.
import { formatFieldValue, formatCurrency } from './shared'

export function A4Template({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette,
  paymentMethod, showBranding, paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  // Details are generic form fields (every retail form defines its own) -
  // split across the two mockup columns rather than trying to guess which
  // ones are "customer" vs "order" fields.
  const mid = Math.ceil(details.length / 2)
  const leftDetails = details.slice(0, mid)
  const rightDetails = details.slice(mid)

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
      padding: '15mm 15mm 18mm', background: '#ffffff', color: '#111',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {logoElement && <div style={{ marginBottom: '0.6rem' }}>{logoElement}</div>}
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{businessName}</div>
          {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{businessAddress}</div>}
          {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
          {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: palette.primary }}>INVOICE</div>
          <div style={{ fontSize: '12px', marginTop: '0.4rem' }}>#{orderNumber}</div>
          <div style={{ fontSize: '12px', color: '#555' }}>{dateStr}</div>
          {paymentMethod && (
            <div style={{
              display: 'inline-block', marginTop: '0.4rem', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.05em', color: palette.primary, border: `1px solid ${palette.primary}`,
              borderRadius: '4px', padding: '0.15rem 0.5rem',
            }}>
              PAID
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${palette.primary}`, margin: '1rem 0 1.2rem' }} />

      {(leftDetails.length > 0 || rightDetails.length > 0) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', marginBottom: '1.2rem' }}>
          <div style={{ flex: 1 }}>
            {leftDetails.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Bill To</div>
                {leftDetails.map(({ field, value }) => (
                  <div key={field.id} style={{ fontSize: '12px', padding: '0.15rem 0' }}>
                    <span style={{ color: '#666' }}>{field.label}: </span>
                    <span>{formatFieldValue(field, value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            {rightDetails.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Invoice Details</div>
                {rightDetails.map(({ field, value }) => (
                  <div key={field.id} style={{ fontSize: '12px', padding: '0.15rem 0' }}>
                    <span style={{ color: '#666' }}>{field.label}: </span>
                    <span>{formatFieldValue(field, value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ background: palette.primary }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#fff', fontWeight: 600 }}>Item</th>
              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#fff', fontWeight: 600 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: '#fff', fontWeight: 600 }}>Unit Price</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: '#fff', fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="invoice-row" style={{ borderBottom: '1px solid #eee', breakInside: 'avoid' }}>
                <td style={{ padding: '0.5rem' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{formatCurrency(item.price)}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
          <div style={{ width: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.2rem 0' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {deliveryFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.2rem 0' }}>
                <span>Delivery</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold',
              color: palette.primary, borderTop: `2px solid ${palette.primary}`, marginTop: '0.4rem', paddingTop: '0.5rem',
            }}>
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginBottom: '1rem' }}>
          {hasPaymentInfo && (
            <div style={{ marginBottom: invoiceNotes ? '0.8rem' : 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Payment Information</div>
              {paymentBankName && <div style={{ fontSize: '12px' }}>Bank: {paymentBankName}</div>}
              {paymentAccountNumber && <div style={{ fontSize: '12px' }}>Account Number: {paymentAccountNumber}</div>}
              {paymentAccountName && <div style={{ fontSize: '12px' }}>Account Name: {paymentAccountName}</div>}
            </div>
          )}
          {invoiceNotes && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        {showBranding && <div style={{ fontSize: '10px', color: '#999' }}>Powered by Verticals</div>}
      </div>
    </div>
  )
}
