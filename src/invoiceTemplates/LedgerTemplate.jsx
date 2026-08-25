// Place at: src/invoiceTemplates/LedgerTemplate.jsx
// Big wordmark top-left with a logo box beneath it, business block
// top-right, numbered circular badges marking each section, thin rule
// dividers throughout.
import { formatFieldValue } from './shared'

function Badge({ n, palette }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '18px', height: '18px', borderRadius: '50%', background: palette.primary,
      color: '#fff', fontSize: '11px', fontWeight: 700, marginRight: '0.5rem', flexShrink: 0,
    }}>
      {n}
    </span>
  )
}

export function LedgerTemplate({
  businessName, businessAddress, businessPhone, businessEmail, logoElement,
  orderNumber, dateStr, details, items, subtotal, deliveryFee, total, palette, showBranding = true,
}) {
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Badge n={1} palette={palette} />
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{businessName}</span>
          </div>
          {businessAddress && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{businessAddress}</div>}
          {businessPhone && <div style={{ fontSize: '11px', color: '#555' }}>{businessPhone}</div>}
          {businessEmail && <div style={{ fontSize: '11px', color: '#555' }}>{businessEmail}</div>}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}`, padding: '0.7rem 0', margin: '1rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
          <Badge n={2} palette={palette} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice Details</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingLeft: '1.6rem' }}>
          <span>Invoice #: <strong>{orderNumber}</strong></span>
          <span>Date: <strong>{dateStr}</strong></span>
        </div>
      </div>

      {details.length > 0 && (
        <div style={{ marginBottom: '1rem', paddingLeft: '1.6rem' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.4rem' }}>
            <Badge n={3} palette={palette} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</span>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
              <Badge n={4} palette={palette} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</span>
            </div>
            {deliveryFee > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0 0.15rem 1.6rem' }}>
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '0.15rem 0 0.15rem 1.6rem' }}>
                  <span>Delivery Fee</span>
                  <span>{deliveryFee.toLocaleString()}</span>
                </div>
              </>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold',
              borderTop: `2px solid ${palette.primary}`, marginTop: '0.3rem', paddingTop: '0.4rem', paddingLeft: '1.6rem'
            }}>
              <span>Total</span>
              <span>{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {showBranding && <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '2.5rem' }}>Powered by Verticals</div>}
    </div>
  )
}
