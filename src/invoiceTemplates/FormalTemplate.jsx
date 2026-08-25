// Place at: src/invoiceTemplates/FormalTemplate.jsx
// A formal business-document look modeled on a shared reference invoice:
// colored accent bar next to the business name/date, a bordered "Bill To"
// box, an S/N-numbered item table with a solid total row, explicit
// "BANK NAME:" / "ACCOUNT NUMBER:" / "ACCOUNT (BENEFICIARY) NAME:" payment
// labels, and an "Invoice Authorized by" + Designation + Signature block
// that no other style has (see invoiceAuthorizedBy/invoiceAuthorizedDesignation
// in Form Settings > Invoice & Receipt Settings).
import { formatFieldValue } from './shared'

export function FormalTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, deliveryFee, total, palette, showBranding = true,
  paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName
  return (
    <div style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <div style={{ width: '4px', background: palette.primary, borderRadius: '2px' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>{businessName}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>{dateStr}</div>
            {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{businessAddress}</div>}
            {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
            {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
          </div>
        </div>
        {logoElement && <div>{logoElement}</div>}
      </div>

      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '1.2rem' }}>INVOICE #{orderNumber}</div>

      {details.length > 0 && (
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ background: palette.primarySoft, color: palette.primary, fontWeight: 700, fontSize: '12px', padding: '0.4rem 0.7rem' }}>Bill To</div>
          <div style={{ border: `1px solid ${palette.border}`, borderTop: 'none', padding: '0.6rem 0.7rem' }}>
            {details.map(({ field, value }) => (
              <div key={field.id} style={{ fontSize: '12px', padding: '0.1rem 0' }}>
                <span style={{ color: '#666' }}>{field.label}: </span>
                <span>{formatFieldValue(field, value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: palette.primary }}>
              <th style={{ padding: '0.4rem', color: '#fff', textAlign: 'left', width: '34px' }}>S/N</th>
              <th style={{ padding: '0.4rem', color: '#fff', textAlign: 'left' }}>Item Description</th>
              <th style={{ padding: '0.4rem', color: '#fff', textAlign: 'center' }}>Unit</th>
              <th style={{ padding: '0.4rem', color: '#fff', textAlign: 'right' }}>Unit Price</th>
              <th style={{ padding: '0.4rem', color: '#fff', textAlign: 'right' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: '0.4rem' }}>{i + 1}</td>
                <td style={{ padding: '0.4rem' }}>{item.name}</td>
                <td style={{ padding: '0.4rem', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right' }}>{item.price.toLocaleString()}</td>
                <td style={{ padding: '0.4rem', textAlign: 'right' }}>{(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
            {deliveryFee > 0 && (
              <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td colSpan={4} style={{ padding: '0.4rem', textAlign: 'right', color: '#666' }}>Delivery</td>
                <td style={{ padding: '0.4rem', textAlign: 'right' }}>{deliveryFee.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: palette.primary }}>
              <td colSpan={4} style={{ padding: '0.5rem', color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>TOTAL</td>
              <td style={{ padding: '0.5rem', color: '#fff', fontWeight: 'bold', textAlign: 'right' }}>{total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ marginTop: '1.4rem' }}>
          {hasPaymentInfo && (
            <div style={{ marginBottom: invoiceNotes ? '0.8rem' : 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '0.4rem' }}>Payment Information</div>
              {paymentBankName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>BANK NAME:</span><span>{paymentBankName}</span>
                </div>
              )}
              {paymentAccountNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>ACCOUNT NUMBER:</span><span>{paymentAccountNumber}</span>
                </div>
              )}
              {paymentAccountName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>ACCOUNT (BENEFICIARY) NAME:</span><span>{paymentAccountName}</span>
                </div>
              )}
            </div>
          )}
          {invoiceNotes && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '0.3rem' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap' }}>{invoiceNotes}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '2.5rem' }}>
        {invoiceAuthorizedBy && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Invoice Authorized by: {invoiceAuthorizedBy}</div>}
        {invoiceAuthorizedDesignation && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Designation: {invoiceAuthorizedDesignation}</div>}
        <div style={{ fontSize: '12px', marginTop: '1.2rem' }}>
          Signature: <span style={{ display: 'inline-block', width: '160px', borderBottom: '1px solid #111' }} />
        </div>
      </div>

      {showBranding && <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '2rem' }}>Powered by Verticals</div>}
    </div>
  )
}
