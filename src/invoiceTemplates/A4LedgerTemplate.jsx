// Place at: src/invoiceTemplates/A4LedgerTemplate.jsx
// A4-sized sibling of LedgerTemplate.jsx: same true A4 page mechanics as
// A4Template.jsx (fixed 210mm x 297mm, print-safe margins), but the Ledger
// look - big wordmark top-left with a logo box beneath it, thin rule
// dividers between sections.
import { formatFieldValue, formatCurrency } from './shared'

export function A4LedgerTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette,
  paymentMethod, showBranding, paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  const mid = Math.ceil(details.length / 2)
  const leftDetails = details.slice(0, mid)
  const rightDetails = details.slice(mid)

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
      padding: '15mm 15mm 18mm', background: '#ffffff', color: '#111',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '34px', fontWeight: 800, color: palette.primary }}>Invoice</div>
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

      <div style={{ borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}`, padding: '0.7rem 0', margin: '1rem 0' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Invoice Details</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span>Invoice #: <strong>{orderNumber}</strong></span>
          <span>Date: <strong>{dateStr}</strong></span>
        </div>
      </div>

      {(leftDetails.length > 0 || rightDetails.length > 0) && (
        <div style={{ marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
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
            {rightDetails.length > 0 && rightDetails.map(({ field, value }) => (
              <div key={field.id} style={{ fontSize: '12px', padding: '0.15rem 0' }}>
                <span style={{ color: '#666' }}>{field.label}: </span>
                <span>{formatFieldValue(field, value)}</span>
              </div>
            ))}
          </div>
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
                <tr key={i} className="invoice-row" style={{ borderBottom: `1px solid ${palette.border}`, breakInside: 'avoid' }}>
                  <td style={{ padding: '0.4rem 0' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', padding: '0.4rem 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{formatCurrency(item.price)}</td>
                  <td style={{ textAlign: 'right', padding: '0.4rem 0' }}>{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
          <div style={{ width: '260px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>Total</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {deliveryFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0' }}>
                <span>Delivery</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold',
              borderTop: `2px solid ${palette.primary}`, marginTop: '0.3rem', paddingTop: '0.4rem',
            }}>
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: '0.8rem', marginBottom: '1rem' }}>
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

      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        {showBranding && <div style={{ fontSize: '10px', color: '#999' }}>Powered by Verticals</div>}
      </div>
    </div>
  )
}
