// Place at: src/InvoiceModal.jsx
// Replaces receiptPrint.js's popup-window/window.print() flow: this renders
// an on-page invoice (business details from Settings > Invoice, itemized
// cart, order details) and turns it into a downloadable PDF via
// html2canvas + jsPDF instead of handing the person off to the browser's
// print dialog. Shared by the order confirmation screen and Records'
// per-order actions so there's one invoice layout everywhere.
import { useRef, useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function formatFieldValue(field, value) {
  if (Array.isArray(value)) return value.join(', ')
  if (field.type === 'multiplechoicegrid' && value && typeof value === 'object') {
    return Object.entries(value).map(([row, col]) => `${row}: ${col}`).join('; ')
  }
  if (field.type === 'checkboxgrid' && value && typeof value === 'object') {
    return Object.entries(value).map(([row, cols]) => `${row}: ${(cols || []).join(', ')}`).join('; ')
  }
  if (field.type === 'rating') return `${value} / ${field.maxStars ?? 5} stars`
  if (field.type === 'linked_record') return value?.label ? value.label.toString() : ''
  if (field.type === 'location') return [value?.city, value?.state, value?.country].filter(Boolean).join(', ')
  return value.toString()
}

export function InvoiceModal({ form, submission, onClose }) {
  const invoiceRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const settings = form.settings || {}
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const otherFields = form.fields.filter(f => f.type !== 'cart' && f.type !== 'section')

  const items = []
  let subtotal = 0
  let deliveryFee = 0
  cartFields.forEach(field => {
    const cartData = submission.data[field.id]
    if (cartData?.items?.length) {
      cartData.items.forEach(item => {
        subtotal += item.price * item.quantity
        items.push(item)
      })
      deliveryFee += Number(cartData.deliveryFee) || 0
    }
  })
  const total = subtotal + deliveryFee

  const details = otherFields
    .map(field => ({ field, value: submission.data[field.id] }))
    .filter(({ value }) => {
      if (value === undefined || value === null) return false
      return Array.isArray(value) ? value.length > 0 : value.toString().trim() !== ''
    })

  // Same fallback Records itself uses when a submission was built client-side
  // right at checkout, before the real order_number column is populated.
  const orderNumber = submission.order_number
    ? String(submission.order_number)
    : submission.id.replace(/-/g, '').slice(-12).toUpperCase()

  const createdDate = new Date(submission.created_at)
  const dateStr = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const businessName = settings.companyName?.trim() || form.name
  const businessAddress = settings.companyAddress?.trim()
  const businessPhone = settings.companyPhone?.trim()

  async function handleDownload() {
    if (!invoiceRef.current) return
    setDownloading(true)
    setDownloadError('')
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`Invoice-${orderNumber}.pdf`)
    } catch {
      setDownloadError('Could not create the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius)', width: '620px', maxWidth: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 45px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0 }}>Invoice</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Preparing...' : 'Download Invoice'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        {downloadError && (
          <p style={{ color: 'var(--status-critical)', fontSize: '0.85rem', margin: '0.75rem 1.25rem 0' }}>{downloadError}</p>
        )}

        <div style={{ overflowY: 'auto', padding: '1.5rem', background: '#eef0f2' }}>
          {/* Explicit colors throughout (not theme vars) - html2canvas
              snapshots this element as-is, and the PDF must read the same
              regardless of the app's light/dark theme. */}
          <div ref={invoiceRef} style={{ background: '#ffffff', color: '#111', padding: '2rem', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {businessName}
              </div>
              {businessAddress && <div style={{ fontSize: '12px', color: '#444', marginTop: '4px' }}>{businessAddress}</div>}
              {businessPhone && <div style={{ fontSize: '12px', color: '#444' }}>{businessPhone}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111', borderBottom: '2px solid #111', padding: '0.6rem 0', margin: '0 0 1.2rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', borderTop: '2px solid #111', marginTop: '0.3rem', paddingTop: '0.4rem' }}>
                  <span>Total</span>
                  <span>{total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '2.5rem' }}>Powered by Verticals</div>
          </div>
        </div>
      </div>
    </div>
  )
}
