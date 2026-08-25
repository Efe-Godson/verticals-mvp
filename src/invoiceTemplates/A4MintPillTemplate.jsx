// Place at: src/invoiceTemplates/A4MintPillTemplate.jsx
// A4-sized sibling of MintPillTemplate.jsx: same true A4 page mechanics as
// A4Template.jsx (fixed 210mm x 297mm, print-safe margins), but the Modern
// look - centered italic title, pill-shaped section labels, soft-tinted
// table header, rounded totals card.
import { formatFieldValue, formatCurrency } from './shared'

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

export function A4MintPillTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette,
  paymentMethod, showBranding, paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  const hasAuthorizedBy = invoiceAuthorizedBy || invoiceAuthorizedDesignation
  const mid = Math.ceil(details.length / 2)
  const leftDetails = details.slice(0, mid)
  const rightDetails = details.slice(mid)

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
      padding: '15mm 15mm 18mm', background: '#ffffff', color: '#111',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        {logoElement && <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{logoElement}</div>}
        <div style={{ fontSize: '30px', fontStyle: 'italic', fontWeight: 'bold', color: palette.primary }}>Invoice</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '0.4rem' }}>
          Invoice Number: {orderNumber} &nbsp;&nbsp; Invoice Date: {dateStr}
        </div>
        {paymentMethod && (
          <div style={{
            display: 'inline-block', marginTop: '0.5rem', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.05em', color: palette.primary, border: `1px solid ${palette.primary}`,
            borderRadius: '4px', padding: '0.15rem 0.5rem',
          }}>
            PAID
          </div>
        )}
      </div>

      <div style={{ borderTop: `2px solid ${palette.primary}`, margin: '1rem 0 1.2rem' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', marginBottom: '1.2rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px' }}>
            <div style={{ fontWeight: 'bold' }}>{businessName}</div>
            {businessAddress && <div style={{ color: '#555', fontSize: '11px' }}>{businessAddress}</div>}
            {businessPhone && <div style={{ color: '#555', fontSize: '11px' }}>{businessPhone}</div>}
            {businessEmail && <div style={{ color: '#555', fontSize: '11px' }}>{businessEmail}</div>}
          </div>
          {leftDetails.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <Pill palette={palette}>Bill To</Pill>
              <div style={{ marginTop: '0.5rem' }}>
                {leftDetails.map(({ field, value }) => (
                  <div key={field.id} style={{ fontSize: '12px', padding: '0.15rem 0' }}>
                    <span style={{ color: '#666' }}>{field.label}: </span>
                    <span>{formatFieldValue(field, value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {rightDetails.length > 0 && (
          <div style={{ flex: 1, textAlign: 'right' }}>
            <Pill palette={palette}>Invoice Details</Pill>
            <div style={{ marginTop: '0.5rem' }}>
              {rightDetails.map(({ field, value }) => (
                <div key={field.id} style={{ fontSize: '12px', padding: '0.15rem 0' }}>
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
              <tr key={i} className="invoice-row" style={{ borderBottom: `1px solid ${palette.border}`, breakInside: 'avoid' }}>
                <td style={{ padding: '0.5rem' }}>{item.name}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{formatCurrency(item.price)}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(items.length > 0 || hasPaymentInfo || invoiceNotes) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
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
            <div style={{ width: '260px', background: palette.primarySoft, borderRadius: '8px', padding: '0.9rem', flexShrink: 0 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', color: palette.primary, marginTop: '0.2rem' }}>
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {hasAuthorizedBy && (
        <div style={{ marginBottom: '1rem' }}>
          {invoiceAuthorizedBy && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Authorized by: {invoiceAuthorizedBy}</div>}
          {invoiceAuthorizedDesignation && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Designation: {invoiceAuthorizedDesignation}</div>}
          <div style={{ fontSize: '12px', marginTop: '0.8rem' }}>
            Signature: <span style={{ display: 'inline-block', width: '160px', borderBottom: '1px solid #111' }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        {showBranding && <div style={{ fontSize: '10px', color: '#999' }}>Powered by Verticals</div>}
      </div>
    </div>
  )
}
