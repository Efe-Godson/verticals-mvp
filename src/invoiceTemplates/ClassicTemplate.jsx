// Place at: src/invoiceTemplates/ClassicTemplate.jsx
// The original (and still default) invoice layout, moved out of
// InvoiceModal.jsx unchanged in structure - only the borders/accent lines
// now follow the chosen palette instead of a hardcoded #111, and an optional
// logo renders above the business name when one is configured. Body text
// stays neutral gray/black across every palette for readability.
import { formatFieldValue } from './shared'

export function ClassicTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding = true,
  paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  const hasAuthorizedBy = invoiceAuthorizedBy || invoiceAuthorizedDesignation
  return (
    <div style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {logoElement && <div style={{ marginBottom: '0.6rem', display: 'flex', justifyContent: 'center' }}>{logoElement}</div>}
        <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {businessName}
        </div>
        {businessAddress && <div style={{ fontSize: '12px', color: '#444', marginTop: '4px' }}>{businessAddress}</div>}
        {businessPhone && <div style={{ fontSize: '12px', color: '#444' }}>{businessPhone}</div>}
        {businessEmail && <div style={{ fontSize: '12px', color: '#444' }}>{businessEmail}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${palette.primary}`, borderBottom: `2px solid ${palette.primary}`, padding: '0.6rem 0', margin: '0 0 1.2rem' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</div>
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>#{orderNumber}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{dateStr}</div>
        </div>
      </div>

      {details.length > 0 && (
        <div style={{ marginBottom: '1.2rem' }}>
          {details.map(({ field, value }) => (
            <div key={field.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', fontSize: '13px', padding: '0.25rem 0' }}>
              <span style={{ color: '#666' }}>{field.label}</span>
              <span style={{ textAlign: 'right' }}>{formatFieldValue(field, value)}</span>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ textAlign: 'left', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Item</th>
              <th style={{ textAlign: 'center', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Price</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.4rem 0' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '0.4rem 0' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{item.price.toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {items.length > 0 && (
        <div style={{ marginLeft: 'auto', width: '220px' }}>
          {deliveryFee > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.2rem 0' }}>
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.2rem 0' }}>
                <span>Delivery Fee</span>
                <span>{deliveryFee.toLocaleString()}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', borderTop: `2px solid ${palette.primary}`, marginTop: '0.3rem', paddingTop: '0.4rem' }}>
            <span>Total</span>
            <span>{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ borderTop: `1px solid ${palette.border}`, marginTop: '1.5rem', paddingTop: '1rem' }}>
          {hasPaymentInfo && (
            <div style={{ marginBottom: invoiceNotes ? '0.7rem' : 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Payment Information</div>
              {paymentBankName && <div style={{ fontSize: '12px' }}>Bank: {paymentBankName}</div>}
              {paymentAccountNumber && <div style={{ fontSize: '12px' }}>Account Number: {paymentAccountNumber}</div>}
              {paymentAccountName && <div style={{ fontSize: '12px' }}>Account Name: {paymentAccountName}</div>}
            </div>
          )}
          {invoiceNotes && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
            </div>
          )}
        </div>
      )}

      {hasAuthorizedBy && (
        <div style={{ marginTop: '1.2rem' }}>
          {invoiceAuthorizedBy && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Authorized by: {invoiceAuthorizedBy}</div>}
          {invoiceAuthorizedDesignation && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Designation: {invoiceAuthorizedDesignation}</div>}
          <div style={{ fontSize: '12px', marginTop: '0.8rem' }}>
            Signature: <span style={{ display: 'inline-block', width: '160px', borderBottom: '1px solid #111' }} />
          </div>
        </div>
      )}

      {showBranding && <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: hasAuthorizedBy ? '1.5rem' : '2.5rem' }}>Powered by Verticals</div>}
    </div>
  )
}
