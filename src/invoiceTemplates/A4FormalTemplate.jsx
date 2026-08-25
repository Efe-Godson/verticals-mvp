// Place at: src/invoiceTemplates/A4FormalTemplate.jsx
// A4-sized sibling of FormalTemplate.jsx: same true A4 page mechanics as
// A4Template.jsx (fixed 210mm x 297mm, print-safe margins), but the Formal
// look - accent bar next to the business name/date, a single bordered
// "Bill To" box, an S/N-numbered item table with a solid total row, and the
// "Invoice Authorized by" + Designation + Signature block.
import { formatFieldValue } from './shared'

export function A4FormalTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, deliveryFee, total, palette,
  paymentMethod, showBranding, paymentBankName, paymentAccountNumber, paymentAccountName, invoiceNotes,
  invoiceAuthorizedBy, invoiceAuthorizedDesignation,
}) {
  const hasPaymentInfo = paymentBankName || paymentAccountNumber || paymentAccountName

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
      padding: '15mm 15mm 18mm', background: '#ffffff', color: '#111',
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '3px', background: palette.primary, marginRight: '2px' }} />
          <div style={{ width: '3px', background: palette.primary, marginRight: '0.7rem' }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>{businessName}</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{dateStr}</div>
            {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{businessAddress}</div>}
            {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
            {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {logoElement && <div style={{ marginBottom: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>{logoElement}</div>}
          {paymentMethod && (
            <div style={{
              display: 'inline-block', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.05em', color: palette.primary, border: `1px solid ${palette.primary}`,
              borderRadius: '4px', padding: '0.15rem 0.5rem',
            }}>
              PAID
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: '14px', fontWeight: 'bold', margin: '1rem 0 1.2rem' }}>INVOICE #{orderNumber}</div>

      {details.length > 0 && (
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ background: palette.primarySoft, color: palette.primary, fontWeight: 700, fontSize: '12px', padding: '0.5rem 0.8rem' }}>Bill To</div>
          <div style={{ border: `1px solid ${palette.border}`, borderTop: 'none', padding: '0.7rem 0.8rem' }}>
            {details.map(({ field, value }) => (
              <div key={field.id} style={{ fontSize: '12px', fontWeight: 'bold', padding: '0.15rem 0' }}>
                {formatFieldValue(field, value)}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: palette.primary }}>
              <th style={{ padding: '0.5rem', color: '#fff', textAlign: 'left', width: '40px' }}>S/N</th>
              <th style={{ padding: '0.5rem', color: '#fff', textAlign: 'left' }}>ITEM DESCRIPTION</th>
              <th style={{ padding: '0.5rem', color: '#fff', textAlign: 'center' }}>UNIT</th>
              <th style={{ padding: '0.5rem', color: '#fff', textAlign: 'right' }}>UNIT PRICE (NGN)</th>
              <th style={{ padding: '0.5rem', color: '#fff', textAlign: 'right' }}>COST (NGN)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="invoice-row" style={{ borderBottom: '1px solid #eee', breakInside: 'avoid' }}>
                <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                <td style={{ padding: '0.5rem' }}>{item.name}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.price.toLocaleString()}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            ))}
            {deliveryFee > 0 && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#666' }}>Delivery</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{deliveryFee.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: palette.primary }}>
              <td colSpan={4} style={{ padding: '0.6rem', color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: '15px' }}>TOTAL</td>
              <td style={{ padding: '0.6rem', color: '#fff', fontWeight: 'bold', textAlign: 'right', fontSize: '15px' }}>{total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {(hasPaymentInfo || invoiceNotes) && (
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '1.2rem', marginBottom: '1rem' }}>
          {hasPaymentInfo && (
            <div style={{ marginBottom: invoiceNotes ? '0.8rem' : 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Payment Information</div>
              {paymentBankName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>BANK NAME:</span><span>{paymentBankName}</span>
                </div>
              )}
              {paymentAccountNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>ACCOUNT NUMBER:</span><span>{paymentAccountNumber}</span>
                </div>
              )}
              {paymentAccountName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '12px', padding: '0.15rem 0' }}>
                  <span>ACCOUNT (BENEFICIARY) NAME:</span><span>{paymentAccountName}</span>
                </div>
              )}
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

      {(invoiceAuthorizedBy || invoiceAuthorizedDesignation) && (
        <div style={{ marginBottom: '1.2rem' }}>
          {invoiceAuthorizedBy && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Invoice Authorized by: {invoiceAuthorizedBy}</div>}
          {invoiceAuthorizedDesignation && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Designation: {invoiceAuthorizedDesignation}</div>}
        </div>
      )}
      <div style={{ fontSize: '12px', marginBottom: '1rem' }}>
        Signature: <span style={{ display: 'inline-block', width: '200px', borderBottom: '1px solid #111' }} />
      </div>

      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        {showBranding && <div style={{ fontSize: '10px', color: '#999' }}>Powered by Verticals</div>}
      </div>
    </div>
  )
}
