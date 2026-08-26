// Place at: src/invoiceTemplates/LedgerTemplate.jsx
// Big wordmark top-left with a logo box beneath it, business block
// top-right, thin rule dividers between sections.
import { formatFieldValue } from './shared'

export function LedgerTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding = true,
  paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation, signatureElement,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  const hasAuthorizedBy = invoiceAuthorizedBy || invoiceAuthorizedDesignation
  return (
    <div style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: palette.primary }}>Invoice</div>
          {logoElement && (
            <div style={{ marginTop: '0.7rem', border: `1px solid ${palette.border}`, borderRadius: '6px', padding: '0.5rem', display: 'inline-flex' }}>
              {logoElement}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{businessName}</div>
          {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{businessAddress}</div>}
          {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
          {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}`, padding: '0.7rem 0', margin: '1rem 0' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Invoice Details</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span>Invoice #: <strong>{orderNumber}</strong></span>
          <span>Date: <strong>{dateStr}</strong></span>
        </div>
      </div>

      {details.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {details.map(({ field, value }) => (
            <div key={field.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', fontSize: '13px', padding: '0.2rem 0' }}>
              <span style={{ color: '#666' }}>{field.label}</span>
              <span style={{ textAlign: 'right' }}>{formatFieldValue(field, value)}</span>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Items</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${palette.primary}` }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Item/Service</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0', color: '#666', fontWeight: 600 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                  <td style={{ padding: '0.4rem 0' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', padding: '0.4rem 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{item.price.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '240px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Total</div>
            {deliveryFee > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0' }}>
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0' }}>
                  <span>Delivery Fee</span>
                  <span>{deliveryFee.toLocaleString()}</span>
                </div>
              </>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold',
              borderTop: `2px solid ${palette.primary}`, marginTop: '0.3rem', paddingTop: '0.4rem',
            }}>
              <span>Total</span>
              <span>{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ marginTop: '1.2rem', paddingTop: '0.8rem', borderTop: `1px solid ${palette.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>{hasPaymentInfo ? 'Payment Information' : 'Notes'}</div>
          {hasPaymentInfo && (
            <div style={{ fontSize: '13px', marginBottom: invoiceNotes ? '0.5rem' : 0 }}>
              {paymentBankName && <div>Bank: {paymentBankName}</div>}
              {paymentAccountNumber && <div>Account Number: {paymentAccountNumber}</div>}
              {paymentAccountName && <div>Account Name: {paymentAccountName}</div>}
            </div>
          )}
          {invoiceNotes && (
            <>
              {hasPaymentInfo && <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>Notes</div>}
              <div style={{ fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
            </>
          )}
        </div>
      )}

      {hasAuthorizedBy && (
        <div style={{ marginTop: '1.2rem' }}>
          {invoiceAuthorizedBy && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Authorized by: {invoiceAuthorizedBy}</div>}
          {invoiceAuthorizedDesignation && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Designation: {invoiceAuthorizedDesignation}</div>}
          <div style={{ fontSize: '12px', marginTop: '0.8rem' }}>
            Signature: <span style={{ display: 'inline-block', width: '160px', textAlign: 'center', borderBottom: '1px solid #111' }}>{signatureElement}</span>
          </div>
        </div>
      )}

      {showBranding && <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: hasAuthorizedBy ? '1.5rem' : '2.5rem' }}>Powered by Verticals</div>}
    </div>
  )
}
