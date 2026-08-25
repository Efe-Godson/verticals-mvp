// Place at: src/invoiceTemplates/MintPillTemplate.jsx
// Centered logo, large italic title, pill-shaped section labels, colored
// table header, notes block bottom-left / totals bottom-right.
import { formatFieldValue } from './shared'

function Pill({ children, palette }) {
  return (
    <span style={{
      display: 'inline-block', background: palette.primary, color: '#fff', fontSize: '10px',
      fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '0.3rem 0.8rem', borderRadius: '999px',
    }}>
      {children}
    </span>
  )
}

export function MintPillTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding = true,
  paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  const hasAuthorizedBy = invoiceAuthorizedBy || invoiceAuthorizedDesignation
  return (
    <div style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        {logoElement && <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{logoElement}</div>}
        <div style={{ fontSize: '26px', fontStyle: 'italic', fontWeight: 'bold', color: palette.primary }}>Invoice</div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '0.4rem' }}>Invoice Number: {orderNumber} &nbsp;&nbsp; Invoice Date: {dateStr}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', margin: '1.4rem 0 1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px' }}>
            <div style={{ fontWeight: 'bold' }}>{businessName}</div>
            {businessAddress && <div style={{ color: '#555', fontSize: '11px' }}>{businessAddress}</div>}
            {businessPhone && <div style={{ color: '#555', fontSize: '11px' }}>{businessPhone}</div>}
            {businessEmail && <div style={{ color: '#555', fontSize: '11px' }}>{businessEmail}</div>}
          </div>
        </div>
        {details.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <Pill palette={palette}>Order Details</Pill>
            <div style={{ marginTop: '0.5rem' }}>
              {details.map(({ field, value }) => (
                <div key={field.id} style={{ fontSize: '11px', padding: '0.15rem 0' }}>
                  <span style={{ color: '#666' }}>{field.label}: </span>
                  <span>{formatFieldValue(field, value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ background: palette.primarySoft }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: palette.primary, fontWeight: 700 }}>Item</th>
              <th style={{ textAlign: 'center', padding: '0.5rem', color: palette.primary, fontWeight: 700 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: palette.primary, fontWeight: 700 }}>Unit Price</th>
              <th style={{ textAlign: 'right', padding: '0.5rem', color: palette.primary, fontWeight: 700 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: '0.4rem 0.5rem' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>{item.price.toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>{(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(items.length > 0 || hasPaymentInfo || invoiceNotes) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            {hasPaymentInfo && (
              <div style={{ marginBottom: invoiceNotes ? '0.8rem' : 0 }}>
                <Pill palette={palette}>Payment</Pill>
                <div style={{ marginTop: '0.5rem', fontSize: '12px' }}>
                  {paymentBankName && <div>Bank: {paymentBankName}</div>}
                  {paymentAccountNumber && <div>Account Number: {paymentAccountNumber}</div>}
                  {paymentAccountName && <div>Account Name: {paymentAccountName}</div>}
                </div>
              </div>
            )}
            {invoiceNotes && (
              <div>
                <Pill palette={palette}>Notes</Pill>
                <div style={{ marginTop: '0.5rem', fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <div style={{ width: '220px', background: palette.primarySoft, borderRadius: '8px', padding: '0.8rem', flexShrink: 0 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: palette.primary, marginTop: '0.2rem' }}>
                <span>Total</span>
                <span>{total.toLocaleString()}</span>
              </div>
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
