// Place at: src/invoiceTemplates/BoldHeaderTemplate.jsx
// Bold "INVOICE" wordmark, left company block / right invoice-details
// table, colored table header row, signature line at the bottom.
import { formatFieldValue } from './shared'

export function BoldHeaderTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding = true,
  paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  return (
    <div style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: palette.primary, letterSpacing: '0.5px' }}>INVOICE</div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: palette.primary, marginTop: '0.6rem' }}>{businessName}</div>
          {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{businessAddress}</div>}
          {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
          {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
        </div>
        {logoElement && <div>{logoElement}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice No.</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{orderNumber}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice Date</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{dateStr}</div>
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
            <tr style={{ background: palette.primary }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', color: '#fff', fontWeight: 600 }}>Description</th>
              <th style={{ textAlign: 'center', padding: '0.5rem 0.5rem', color: '#fff', fontWeight: 600 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', color: '#fff', fontWeight: 600 }}>Rate</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', color: '#fff', fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 === 1 ? palette.primarySoft : 'transparent' }}>
                <td style={{ padding: '0.4rem 0.5rem' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>{item.price.toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>{(item.price * item.quantity).toLocaleString()}</td>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', borderTop: `2px solid ${palette.primary}`, marginTop: '0.3rem', paddingTop: '0.4rem', color: palette.primary }}>
            <span>Total</span>
            <span>{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
          {hasPaymentInfo && (
            <div>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Payment Information</div>
              {paymentBankName && <div style={{ fontSize: '12px' }}>Bank: {paymentBankName}</div>}
              {paymentAccountNumber && <div style={{ fontSize: '12px' }}>Account Number: {paymentAccountNumber}</div>}
              {paymentAccountName && <div style={{ fontSize: '12px' }}>Account Name: {paymentAccountName}</div>}
            </div>
          )}
          {invoiceNotes && (
            <div style={{ maxWidth: '260px' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #999', width: '160px', paddingTop: '0.3rem', fontSize: '10px', color: '#888' }}>Authorized Signatory</div>
        </div>
      </div>

      {showBranding && <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '1.5rem' }}>Powered by Verticals</div>}
    </div>
  )
}
